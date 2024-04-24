const axios = require("axios");
const fs = require("fs");
const Website = require("./models/website.model.js");
const GMap = require("./models/gmap.model.js");
const Index = require("./models/index.model.js");
const activitiesJSON = require("./json/activities.json");
const countriesJSON = require("./json/countries.json");
require("dotenv").config();
const { io } = require("socket.io-client");

const socket = io("http://35.202.239.99:1053");

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

socket.on("connect", () => {
  socket.emit("ping", {
    type: "cli",
    id: process.env.ID,
    data: { progress: 0 },
    dead: false,
  });
});

socket.on("message", (data) => {});

socket.on("disconnect", () => {
  console.log("bye");
});

const crawlWebsiteData = async (url) => {
  try {
    const existingWebsite = await Website.findOne({ url });
    if (existingWebsite) return existingWebsite.result;

    const formattedUrl = url
      .replace("www.", "")
      .split("//")[1]
      .replace("/", "");
    const techData = await fetchTechnologyData(formattedUrl);
    const additionalData = await fetchAdditionalData(url);

    let responseData = techData || {
      emails: additionalData.email_addresses,
      phones: additionalData.phone_numbers,
      socials: additionalData.social_links,
    };

    await Website.create({ url, result: responseData });
    return responseData;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const fetchTechnologyData = (formattedUrl) => {
  return axios
    .post(
      "https://api.dataforseo.com/v3/domain_analytics/technologies/domain_technologies/live",
      [
        {
          target: formattedUrl,
        },
      ],
      {
        headers: {
          "content-type": "application/json",
          Authorization:
            "Basic aGVsbG9AYnJvd25zb25lLmNvbTo1NjgyYzI1ZGMxOGQxM2Fi",
        },
      }
    )
    .then((response) => response.data.tasks[0]?.result[0])
    .catch((error) => {
      console.error("Error fetching technology data:", error);
      return null;
    });
};

const fetchAdditionalData = (url) => {
  return axios
    .get("http://localhost:5001/api/information", { params: { url } })
    .then((response) => response.data)
    .catch((error) => {
      console.error("Error fetching additional data:", error);
      return {};
    });
};

const getCountries = () => {
  return countriesJSON.map((country) => country.cca2);
};

// {
//   "id": "3d-printing-service",
//   "text": "3D printing service"
// },
// {
//   "id": "atm",
//   "text": "ATM"
// },

const getActivities = () => {
  return activitiesJSON.map((activity) => activity.text);
};

const getLocations = async (params) =>
  new Promise((resolve) =>
    axios
      .get(`https://scrap.io/api/autocomplete/gmap-locations`, {
        params,
      })
      .then((response) => {
        resolve(response.data);
      })
      .catch((error) => {
        console.error(error);
        resolve([]);
      })
  );

const fetchNearbyPlaces = async (latitude, longitude, radius, placeType) => {
  const location = `${latitude},${longitude}`;
  const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
  let allPlaces = [];
  let nextPageToken = null;

  try {
    do {
      const response = await axios.get(apiUrl, {
        params: {
          location,
          radius,
          type: placeType,
          key: process.env.GOOGLE_MAPS_API_KEY,
          pagetoken: nextPageToken,
        },
      });

      if (response.data.status === "OK") {
        allPlaces = [...allPlaces, ...response.data.results];
        nextPageToken = response.data.next_page_token;

        // Google Places API requires a short delay before requesting the next page
        if (nextPageToken) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay for reliability
        }
      } else {
        console.error(
          "Failed to fetch nearby places:",
          response.data.error_message || response.data.status
        );
        if (
          response.data.status === "OVER_QUERY_LIMIT" ||
          response.data.status === "REQUEST_DENIED"
        )
          process.exit(1);
        break; // Exit the loop if the status is not OK
      }
    } while (nextPageToken);

    return allPlaces;
  } catch (error) {
    console.error("Error fetching nearby places:", error);
    return [];
  }
};

const fetchStreetDetails = async (searchQuery) => {
  let streetDetails = [];
  let nextPageToken = null;

  try {
    do {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json`,
        {
          params: {
            key: process.env.GOOGLE_MAP_API_KEY,
            query: searchQuery,
            pagetoken: nextPageToken,
          },
        }
      );

      if (response.status === 200 && response.data.status === "OK") {
        streetDetails = [
          ...streetDetails,
          ...response.data.results.map((result) => ({
            name: result.name,
            location: result.geometry.location, // latitude and longitude
          })),
        ];
        nextPageToken = response.data.next_page_token;

        // Google Places API recommends a short delay before requesting the next page
        if (nextPageToken) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Adjusted delay for better API compliance
        }
      } else {
        console.error(
          "Failed to fetch streets:",
          response.data.error_message || "Unknown error"
        );
        if (
          response.data.status === "OVER_QUERY_LIMIT" ||
          response.data.status === "REQUEST_DENIED"
        )
          process.exit(1);
        break;
      }
    } while (nextPageToken);
  } catch (error) {
    console.error("Error fetching streets:", error);
  }

  return streetDetails;
};

const exploreAndIndexPlaces = async (
  activity,
  country,
  division,
  city,
  progress
) => {
  let query = "streets ";
  query += city ? `in ${city}` : "";
  query += division?.division1 ? `, ${division.division1}` : "";
  query += division?.division2 ? `, ${division.division2}` : "";
  query += country ? `, ${country}` : "";
  query += city ? `, ${city}` : "";

  try {
    let searchCriteria = [];
    if (activity) searchCriteria.push(activity);
    if (division?.division1) searchCriteria.push(division.division1);
    if (division?.division2) searchCriteria.push(division.division2);
    if (country) searchCriteria.push(country);
    if (city) searchCriteria.push(city);

    const streetDetails = await fetchStreetDetails(query);
    socket.emit("message", {
      type: "cli",
      activity,
      country,
      primaryDivision: division?.division1,
      secondaryDivision: division?.division2,
      city,
      nStreets: streetDetails.length,
      progress,
    });

    for (const streetDetail of streetDetails) {
      const nearbyPlaces = await fetchNearbyPlaces(
        streetDetail.location.lat,
        streetDetail.location.lng,
        100,
        activity
      );
      socket.emit("message", {
        type: "cli",
        activity,
        country,
        primaryDivision: division?.division1,
        secondaryDivision: division?.division2,
        city,
        nStreets: streetDetails.length,
        nPlaces: nearbyPlaces.length,
        progress,
      });
      for (const place of nearbyPlaces) {
        await Index.updateOne(
          { place_id: place.place_id },
          { $set: { search: searchCriteria } },
          { upsert: true }
        );

        let placeDetails = await GMap.findOne({
          place_id: place.place_id,
        });
        if (!placeDetails) {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${process.env.GOOGLE_MAP_API_KEY}`
          );
          if (response.status === 200 && response.data.status === "OK") {
            placeDetails = await GMap.create({
              place_id: place.place_id,
              result: response.data.result,
            });
          }
        }
        console.log(place.place_id);
        // Optional: Process website data if available
        // if (placeDetails?.result?.website) {
        //   console.log(placeDetails.result.website);
        //   await crawlWebsiteData(placeDetails.result.website);
        // }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Throttle requests
      }
    }
  } catch (error) {
    console.error("Error in exploreAndIndexPlaces:", error);
  }
};

let progress = 0;

const main = async () => {
  const countries = getCountries();
  const activities = getActivities();
  console.log(activities.length);
  const partitionIndex = parseInt(process.env.ID, 10) || 0;
  const partitionSize = Math.ceil(activities.length / 5);
  const startIndex = partitionIndex * partitionSize;
  const endIndex = Math.min(startIndex + partitionSize, activities.length);
  const selectedActivities = activities.slice(startIndex, endIndex);

  for (let activityIndex in selectedActivities) {
    progress = activityIndex / selectedActivities.length;
    let activity = selectedActivities[activityIndex];
    socket.emit("message", { type: "cli", activity, progress });
    for (let countryIndex in countries) {
      progress += 1 / selectedActivities.length / countries.length;
      let country = countries[countryIndex];
      socket.emit("message", { type: "cli", activity, country, progress });
      let primaryDivisions = await fetchLocationDetails("admin1", country);
      for (let primaryDivisionIndex in primaryDivisions) {
        let primaryDivision = primaryDivisions[primaryDivisionIndex];
        socket.emit("message", {
          type: "cli",
          activity,
          country,
          primaryDivision: primaryDivision.text,
          progress,
        });
        let secondaryDivisions = await fetchLocationDetails(
          "admin2",
          country,
          primaryDivision.id
        );
        for (let secondaryDivisionIndex in secondaryDivisions) {
          let secondaryDivision = secondaryDivisions[secondaryDivisionIndex];
          socket.emit("message", {
            type: "cli",
            activity,
            country,
            primaryDivision: primaryDivision.text,
            secondaryDivision: secondaryDivision.text,
            progress,
          });
          let cities = await fetchLocationDetails(
            "city",
            country,
            primaryDivision.id,
            secondaryDivision.id
          );
          for (let cityIndex in cities) {
            let city = cities[cityIndex];
            socket.emit("message", {
              type: "cli",
              activity,
              country,
              primaryDivision: primaryDivision.text,
              secondaryDivision: secondaryDivision.text,
              city: city.text,
              progress,
            });
            fs.writeFileSync(
              "./query.log",
              JSON.stringify({
                activity,
                country,
                primaryDivision,
                secondaryDivision,
                city,
              })
            );
            fs.writeFileSync(
              "./index.log",
              JSON.stringify({
                activityIndex,
                countryIndex,
                primaryDivisionIndex,
                secondaryDivisionIndex,
                cityIndex,
              })
            );
            await exploreAndIndexPlaces(
              activity,
              country,
              {
                division1: primaryDivision.text,
                division2: secondaryDivision.text,
              },
              city.text,
              progress
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }
    }
  }
};

async function fetchLocationDetails(
  type,
  countryCode,
  admin1Code = null,
  admin2Code = null
) {
  const params = { locale: "en", type, country_code: countryCode };
  if (admin1Code) params.admin1_code = admin1Code;
  if (admin2Code) params.admin2_code = admin2Code;
  try {
    const response = await getLocations(params);
    return response;
  } catch (error) {
    console.error(`Error fetching ${type} details:`, error);
    return [];
  }
}

mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: process.env.DB_NAME,
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD,
  })
  .then(() => {
    console.log("Connected to the database!");
    main();
  })
  .catch((err) => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });
