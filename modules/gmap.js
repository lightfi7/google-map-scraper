const axios = require("axios");

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
          key: config.apiKey,
          pagetoken: nextPageToken,
        },
      });

      if (response.data.status === "OK") {
        allPlaces = [...allPlaces, ...response.data.results];
        nextPageToken = response.data.next_page_token;

        // Google Places API requires a short delay before requesting the next page
        if (nextPageToken) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased delay for reliability
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

const fetchStreets = async (searchQuery) => {
  let streets = [];
  let nextPageToken = null;

  try {
    do {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json`,
        {
          params: {
            key: config.apiKey,
            query: searchQuery,
            pagetoken: nextPageToken,
          },
        }
      );

      if (response.status === 200 && response.data.status === "OK") {
        streets = [
          ...streets,
          ...response.data.results.map((result) => ({
            name: result.name,
            location: result.geometry.location, // latitude and longitude
          })),
        ];
        nextPageToken = response.data.next_page_token;

        // Google Places API recommends a short delay before requesting the next page
        if (nextPageToken) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Adjusted delay for better API compliance
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

  return streets;
};

module.exports = {
  fetchNearbyPlaces,
  fetchStreets,
};
