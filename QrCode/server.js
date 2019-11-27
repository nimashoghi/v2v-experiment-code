var express = require('express');

var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

//
// app.configure(function() {
//   var pub = __dirname + "./public";
//   pub = require("path").normalize(pub);
//   app.set('views', __dirname + '/views');
//   app.set('view engine', 'jade');
// });

// app.use(express.bodyParser());
// app.use(express.cookieParser());

app.get("/hi", function(req, res) {
    res.send("hi")
})

io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('qr-codes', function (data) {
    console.log(data);
  });
});

// io.on("qr-codes", function(msg) {
//
// })


http.listen(8080, function(){
  console.log('listening on *:3000');
});


console.log("Created server running on http://localhost:3000");
