const axios = require("axios");
const Website = require("../database/models/website.model.js");

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

module.exports = {
  crawlWebsiteData,
};
