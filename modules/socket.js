const { io } = require("socket.io-client");

//"http://35.202.239.99:1053"
const makeSocketConnection = (url, callback) => {
  const socket = io(url);
  if (callback) callback(socket);
};

module.exports = { makeSocketConnection };
