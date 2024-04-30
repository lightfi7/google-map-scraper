const axios = require("axios");
axios

async function fetchCityAndDivisions(
  type,
  countryCode,
  admin1Code = null,
  admin2Code = null
) {
  const params = { locale: "en", type, country_code: countryCode };
  if (admin1Code) params.admin1_code = admin1Code;
  if (admin2Code) params.admin2_code = admin2Code;
  try {
    const response = await new Promise((resolve) =>
      axios
        .get(`https://scrap.io/api/autocomplete/gmap-locations`, {
          params,
          timeout: 5000
        })
        .then((response) => {
          resolve(response.data);
        })
        .catch((error) => {
          s;
          console.error(error);
          resolve([]);
        })
    );
    return response;
  } catch (error) {
    console.error(`Error fetching ${type} details:`, error);
    return [];
  }
}

module.exports = { fetchCityAndDivisions };
