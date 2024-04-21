const axios = require("axios");
const fs = require("fs");
const Website = require("./models/website.model.js");
const GMap = require("./models/gmap.model.js");
const Index = require("./models/index.model.js");
const activitiesJSON = require("./json/activities.json");
const countriesJSON = require("./json/countries.json");
require("dotenv").config();

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const crawl = (url) =>
  new Promise(async (resolve, reject) => {
    let response = null;
    try {
      const w = await Website.findOne({ url: url });
      if (w) resolve(w.result);
      else {
        response = await new Promise((resolve) => {
          const post_array = [];
          post_array.push({
            target: url,
          });
          axios({
            method: "post",
            url: "https://api.dataforseo.com/v3/domain_analytics/technologies/domain_technologies/live",
            data: [
              {
                target: `${url
                  .replace("www.", "")
                  .split("//")[1]
                  .replace("/", "")}`,
              },
            ],
            headers: {
              "content-type": "application/json",
              Authorization:
                "Basic aGVsbG9AYnJvd25zb25lLmNvbTo1NjgyYzI1ZGMxOGQxM2Fi",
            },
          })
            .then(function (rr) {
              var result = rr["data"].tasks[0]?.result[0];
              resolve(result);
            })
            .catch(function (error) {
              resolve(null);
            });
        });
        const response_ = await new Promise((resolve) => {
          axios
            .get("http://localhost:5001/api/information", { params: { url } })
            .then((response) => {
              resolve(response.data);
            })
            .catch((error) => {
              resolve([]);
            });
        });
        if (response === null) {
          response = {};
          response.emails = response_.email_addresses;
          response.phones = response_.phone_numbers;
          response.socials = response_.social_links;
        }
        Website.create({
          url: url,
          result: response,
        });
        resolve(response);
      }
    } catch (err) {
      console.log(err);
      resolve(response);
    }
  });

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

const fetchAllNearbyPlaces = async (latitude, longitude, radius, type) => {
  const apiKey = process.env.GOOGLE_MAP_API_KEY; // Ensure your API key is correctly set here
  const location = `${latitude},${longitude}`;
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
  let allResults = [];
  let pageToken = null;

  try {
    do {
      const response = await axios.get(url, {
        params: {
          location,
          radius,
          type,
          key: apiKey,
          pagetoken: pageToken,
        },
      });

      if (response.data.status === "OK") {
        allResults = allResults.concat(response.data.results);
        pageToken = response.data.next_page_token;

        // The Google Places API requires a short delay before requesting the next page
        if (pageToken) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        } else break;
      } else {
        console.error("Failed to fetch nearby places:", response.data);
        break; // Exit the loop if the status is not OK
      }
    } while (pageToken);

    return allResults;
  } catch (error) {
    console.error("Error fetching nearby places:", error.message);
    return [];
  }
};

const fetchStreets = async (q) => {
  let streets = [];
  let pageToken = null;

  try {
    do {
      const params = {
        key: process.env.GOOGLE_MAP_API_KEY,
        query: q,
        pagetoken: pageToken,
      };
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json`,
        { params }
      );

      if (response.status === 200 && response.data.status === "OK") {
        streets = streets.concat(
          response.data.results.map((result) => {
            return {
              name: result.name,
              location: result.geometry.location, // latitude and longitude
            };
          })
        );
        pageToken = response.data.next_page_token;

        if (pageToken) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        } else break;
      } else {
        console.error("Failed to fetch streets:", response.data.error_message);
        break;
      }
    } while (pageToken);
  } catch (error) {
    console.error("Error fetching streets:", error.message);
  }

  return streets;
};

const fetch = async (activity, country, division, city) => {
  q = "streets ";
  if (city) q += "in " + city;
  if (division?.division1) q += ", " + division.division1;
  if (division?.division2) q += ", " + division.division2;
  if (country) q += ", " + country;
  if (city) q += ", " + city;
  try {
    let search = [];
    if (activity && activity != "") search.push(activity);
    if (division && division?.division1 != "") search.push(division?.division1);
    if (division && division?.division2 != "") search.push(division?.division2);
    if (country && country != "") search.push(country);
    if (city && city != "") search.push(city);

    const streets = await fetchStreets(q);
    for (const street of streets) {
      const places = await fetchAllNearbyPlaces(
        street.location.lat,
        street.location.lng,
        100,
        activity
      );
      for (const place of places) {
        const { place_id } = place;
        await Index.updateOne(
          {
            place_id,
          },
          {
            search,
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        let result = (await GMap.findOne({ place_id: place_id }))?.result;
        if (!result) {
          let t = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${process.env.GOOGLE_MAP_API_KEY}`
          );
          if (t.status != 200) continue;
          if (t.data.status == "OK") {
            result = t.data.result;
            await GMap.create({
              place_id,
              result,
            });
          }
        }
        console.log(place_id);
        // try {
        //   if (result.website) {
        //     console.log(result.website);
        //     await crawl(result.website);
        //   }
        // } catch (err) {
        //   console.log(err);
        // }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (err) {
    console.log(err);
  }
};

const main = async () => {
  let countries = getCountries(),
    activities = getActivities();
  activities = activities.slice(0, activities.length / 5);
  for (let i = 0; i < activities.length; i++) {
    let activity = activities[i];
    for (let country of countries) {
      const _divisions = await getLocations({
        locale: "en",
        type: "admin1",
        country_code: country,
      });
      for (let _division of _divisions) {
        const __divisions = await getLocations({
          locale: "en",
          type: "admin2",
          country_code: country,
          admin1_code: _division.id,
        });
        for (let __division of __divisions) {
          const _cities = await getLocations({
            locale: "en",
            type: "city",
            country_code: country,
            admin1_code: _division.id,
            admin2_code: __division.id,
          });
          for (let city of _cities) {
            await fs.writeFileSync(
              "./log.txt",
              JSON.stringify({
                activity,
                country,
                division1: _division.text,
                division2: __division.text,
                city: city.text,
              })
            );
            await await fetch(
              activity,
              country,
              {
                division1: _division.text,
                division2: __division.text,
              },
              city.text
            );
          }
        }
      }
    }
  }
};

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
