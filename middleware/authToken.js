const jwt = require("jsonwebtoken");

async function authToken(req, res, next) {
  try {
    const token =
      req.cookies?.token || req.headers["authorization"]?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Vui lòng đăng nhập!",
        data: [],
        error: true,
        success: false,
      });
    }

    jwt.verify(token, process.env.TOKEN_SECRET_KEY, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          message: "Invalid token.",
          data: [],
          error: true,
          success: false,
        });
      }

      req.user = decoded;
      next();
    });
  } catch (err) {
    res.status(400).json({
      message: err.message || err,
      data: [],
      error: true,
      success: false,
    });
  }
}

module.exports = authToken;
