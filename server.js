var express = require('express');
var app = express();
var path = require('path');
var request = require('sync-request');
var fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const urlDB = 'mongodb://localhost:27017/';
var compression = require('compression');
var schedule = require('node-schedule');
var exercise = require("./src/exercise");
var injuries = require("./src/injuries");
var equipment = require("./src/equipment");

//Serving static files such as Images, CSS, JavaScript
app.use(express.static("public"));

//Using gzip compression on responses to improve performances
app.use(compression());

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + "/public/index.html"));
});

app.get('/exercise', function(req, res) {
  //Update Exercise every month
  schedule.scheduleJob('* * * 1 1 7', function(){
    console.log('Update Exercise '+ new Date());
    if(request('GET', "https://wger.de/api/v2/exerciseinfo?page=1").statusCode == 200) {
      //make a backup of collection exercises
      return new Promise(function (fulfill, reject){
        MongoClient.connect(urlDB, { useNewUrlParser: true },function (err, db) {
          if (err) throw err;
          var dbo = db.db("Fit_AdvisorDB");
          dbo.collection("Exercise").find({}).toArray(function (err, result) {
            if (err) console.log(err);
            fs.writeFile("security_backup_mongoDB/exercise_backup.json",JSON.stringify(result), function(err){
              if(err) console.log("Backup failed");
              console.log("Backup copy of Exercise is correctly stored in security_backup_mongoDB/");
              //delete collection exercise 
              dbo.collection("Exercise").drop(function(err, delOK) {
                if (err) {
                  console.log("Deletion failed");
                  console.log(err);
                }   
                if (delOK) {
                  console.log("Collection deleted");
                  fulfill();
                }
                db.close();
              });
            });
          });
        }); 
      }).then(function(){
        //after deletion redo API call
        exercise.exerciseHandler(MongoClient,urlDB);
        res.sendFile(path.join(__dirname + "/public/exercise_list.html"));
      });  
    }else {
      res.sendFile(path.join(__dirname + "/public/exercise_list.html"));
    }
  });
  res.sendFile(path.join(__dirname + "/public/exercise_list.html"));
});

app.get('/exerciseCategory', function(req, res) {
  var exerciseByCategory = exercise.findByCategory(req.get("category"),MongoClient,urlDB);
  exerciseByCategory.then(function(result){
    res.setHeader('Content-Type', 'application/json');  
    res.send(result);
  });
});

app.get('/exercise_info', function(req, res) {
  res.sendFile(path.join(__dirname + "/public/exercise_info.html"));

});

app.get('/exercise_video', function(req, res) {
  var exercise_video =  exercise.videoExerciseRequest(req.get("name"));
  exercise_video.then(function(result){
    res.setHeader('Content-Type', 'application/json'); 
    res.send(result);
  }).catch(function(){
    res.sendStatus(403);
  });
});

app.get('/food', function(req, res) {
  res.sendFile(path.join(__dirname + "/public/html/food.html"));
});

app.get('/injuries', function(req, res) {
  res.sendFile(path.join(__dirname + "/public/injuries_list.html"));
  injuries.createInjuriesDataset();
});

app.get('/equipment', function(req, res) {
  res.sendFile(path.join(__dirname + "/public/equipment.html"));
});

app.listen(8080, function() {
  exercise.exerciseHandler(MongoClient,urlDB);
  console.log('Fit_Advisor app listening on port 8080!');
});
