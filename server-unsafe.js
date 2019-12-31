const createServer = require("fs-remote/createServer");

// WARNING This will expose your whole filesystem (read-write) to the world!

const PORT = 1234;

createServer().listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
