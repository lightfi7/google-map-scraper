require("dotenv").config();
const fs = require("fs");
const axios = require("axios");

const activitiesJson = require("./data/activities.json");
const countriesJson = require("./data/countries.json");

const { fetchNearbyPlaces, fetchStreets } = require("./modules/gmap");
const { fetchCityAndDivisions } = require("./modules/scrapio");
// const { crawlWebsiteData } = require("./modules/webanalyze");
const { makeDBConnection, GMap, KeyWord } = require("./database");
const { makeSocketConnection } = require("./modules/socket");

const getCountries = () => {
  return countriesJson.map((c) => c.cca2);
};

const getActivities = () => {
  return activitiesJson.map((a) => a.text);
};

const countries = getCountries();
const activities = getActivities();

let running = false;
let progress = 0;

global.config = {
  apiKey: null,
  APPNUM: 0,
  NUMOFAPPS: 1,
  socket: null,
};

const fetchPlacesFromGoogleMap = async (activity, country, division, city) => {
  const { apiKey, socket } = config;

  let query = "streets in";
  if (city) query += ` ${city}`;
  if (division?.division1) query += ` ${division?.division1}`;
  if (division?.division2) query += ` ${division?.division2}`;
  if (country) query += ` ${country}`;

  let filter = {};
  if (activity) filter.activity = activity;
  if (city) filter.city = city;
  if (country) filter.country = country;
  if (division?.division1) filter.division1 = division?.division1;
  if (division?.division2) filter.division2 = division?.division2;

  try {
    console.log(filter);
    let n = await KeyWord.countDocuments(filter);
    console.log(n);
    if (n !== 0) return;
    const streets = await fetchStreets(query);
    socket.emit("message", {
      activity,
      country,
      primaryDivision: division?.division1,
      secondaryDivisions: division?.division2,
      city: city,
      nStreets: streets.length,
    });
    for (const street of streets) {
      if (!running) break;
      const places = await fetchNearbyPlaces(
        street.location.lat,
        street.location.lng,
        100,
        activity
      );
      socket.emit("message", {
        activity,
        country,
        primaryDivision: division?.division1,
        secondaryDivisions: division?.division2,
        city: city,
        nStreets: streets.length,
        nPlaces: places.length,
      });
      for (const place of places) {
        if (!running) break;
        await KeyWord.updateOne(
          { place_id: place.place_id },
          {
            $set: filter,
          },
          { upsert: true }
        );
        let placeDetails = await GMap.findOne({
          place_id: place.place_id,
        });
        if (!placeDetails) {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${apiKey}`
          );
          if (response.status === 200 && response.data.status === "OK") {
            placeDetails = await GMap.create({
              place_id: place.place_id,
              result: response.data.result,
            });
          }
        }
        console.log(place.place_id);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Throttle requests
      }
    }
  } catch (err) {
    console.error(err);
  }
};

const startWork = async () => {
  const { APPNUM, NUMOFAPPS, socket } = config;
  try {
    const startIndex = APPNUM * Math.ceil(activities.length / NUMOFAPPS);
    const endIndex = Math.min(
      startIndex + Math.ceil(activities.length / NUMOFAPPS),
      activities.length
    );
    const selectedActivities = activities.slice(startIndex, endIndex);
    for (let i = 0; i < selectedActivities.length; i++) {
      if (!running) break;
      progress = (i + 1) / selectedActivities.length;
      let activity = selectedActivities[i];
      /**  */
      socket.emit("message", {
        activity,
      });
      for (let j = 0; j < countries.length; j++) {
        if (!running) break;
        progress += 1 / selectedActivities.length / countries.length;
        let country = countries[j];
        /**  */
        socket.emit("message", {
          activity,
          country,
        });
        let primaryDivisions = await fetchCityAndDivisions("admin1", country);
        for (let k = 0; k < primaryDivisions.length; k++) {
          if (!running) break;
          let primaryDivision = primaryDivisions[k];
          /**  */
          socket.emit("message", {
            activity,
            country,
            primaryDivision: primaryDivision.text,
          });
          let secondaryDivisions = await fetchCityAndDivisions(
            "admin2",
            country,
            primaryDivision.id
          );
          if (secondaryDivisions.length != 0)
            for (let l = 0; l < secondaryDivisions.length; l++) {
              if (!running) break;
              let secondaryDivision = secondaryDivisions[l];
              /**  */
              socket.emit("message", {
                activity,
                country,
                primaryDivision: primaryDivision.text,
                secondaryDivisions: secondaryDivisions.text,
              });
              let cities = await fetchCityAndDivisions(
                "city",
                country,
                primaryDivision.id,
                secondaryDivision.id
              );
              for (let m = 0; m < cities.length; m++) {
                if (!running) break;
                let city = cities[m];
                /**  */
                socket.emit("message", {
                  activity,
                  country,
                  primaryDivision: primaryDivision.text,
                  secondaryDivisions: secondaryDivisions.text,
                  city: city.text,
                });
                await fetchPlacesFromGoogleMap(
                  activity,
                  country,
                  {
                    division1: primaryDivision.text,
                    division2: secondaryDivision.text,
                  },
                  city.text
                );
                fs.writeFileSync(
                  "config.json",
                  JSON.stringify({
                    i,
                    j,
                    k,
                    l,
                    m,
                  })
                );
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          else {
            let cities = await fetchCityAndDivisions(
              "city",
              country,
              primaryDivision.id,
              null
            );
            for (let m = 0; m < cities.length; m++) {
              if (!running) break;
              let city = cities[m];
              /**  */
              socket.emit("message", {
                activity,
                country,
                primaryDivision: primaryDivision.text,
                secondaryDivisions: secondaryDivisions.text,
                city: city.text,
              });
              await fetchPlacesFromGoogleMap(
                activity,
                country,
                {
                  division1: primaryDivision.text,
                  division2: "",
                },
                city.text
              );
              fs.writeFileSync(
                "config.log",
                JSON.stringify({
                  i,
                  j,
                  k,
                  l: 0,
                  m,
                })
              );
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in worker:", error);
  }
};

const main = async () => {
  await makeDBConnection();
  makeSocketConnection("http://35.202.239.99:1053", (socket) => {
    // makeSocketConnection("http://127.0.0.1:1053", (socket) => {
    config.socket = socket;

    socket.on("connect", () => {
      console.log(":)");
      socket.emit("ping", { type: "app", progress, running });
    });

    socket.on("config", (data) => {
      config = { ...config, ...data };
    });

    socket.on("start", async () => {
      if (!running) {
        console.log("started");
        running = true;
        socket.emit("started", {});
        await startWork();
        running = false;
        console.log("stopped");
        socket.emit("stopped", {});
      }
    });
    socket.on("stop", async (data) => {
      running = false;
    });

    socket.on("disconnect", () => {
      console.log(";)");
    });
  });
};

main();
