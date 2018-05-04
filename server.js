var express = require('express');
var fs = require('fs');
var app = express();
var password_hash = require('password-hash');
var multer = require('multer');
var nodemailer = require('nodemailer');
var bodyParser = require('body-parser');
var https = require('https');
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
const csvtojson = require('csvtojson');
const Json2csvParser = require('json2csv').Parser;
var options = {
  url: "",
  method: "GET",
  timeout: 10000
};
var empruntPossible = ["1 semaine", "2 semaines", "1 mois"];

app.set('superSecret', process.env.SECRET);

var apiRoutes = express.Router();
// TODO rajouter un champ cles connectes aléatoire permettant de verifier que la personne a bien été connecté

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'xxxeazybossxxx@gmail.com',
    pass: process.env.mdpMail
  }
});

var mailRetard = {
  from: 'xxxeazybossxxx@gmail.com',
  to: '',
  subject: '[Carte ZYBO] Retard !!!!!!!!',
  text: 'Bonjour\n Vous n\'avez pas rendu votre carte Zybo à l\'heure.\n Veuillez la ramener au plus vite auprès de votre professeur! \n\n Cordialement, \n eaZYBOss'
};

var mailRappel = {
  from: 'xxxeazybossxxx@gmail.com',
  to: '',
  subject: '[Carte ZYBO] Rappel',
  text: 'Bonjour, Vous n\'avez pas encore rendu votre carte Zybo. \n Merci de la rendre avant la date limite : '
};

function envoieMailRetard() {
  mailRetard.to = "pauline.huguenel@grenoble-inp.org";
  transporter.sendMail(mailRetard, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

function envoieMailRappel() {
  mailRappel.to = "pauline.huguenel@grenoble-inp.org";
  transporter.sendMail(mailRappel, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

/*
envoieMailRappel();
setInterval(envoieMailRappel, 1000);
*/

app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(express.static('public'));

var bodyParser = require('body-parser');



var mongodb = require('mongodb');
var format = require('util').format;
//We need to work with "MongoClient" interface in order to connect to a mongodb server.
var MongoClient = mongodb.MongoClient;
var url = 'mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.DB_PORT+'/'+process.env.DB;

apiRoutes.post("/appAuthenticate", function (req, rep) {
  MongoClient.connect(url, function (err, client) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      // do some work here with the database.
      client.db(process.env.DB).collection("private").find({ "code" : req.body.code}).toArray(function (err, res) {
          if (res.length != 0) {
            var payload = {
              login: res[0].login
            }
            var token = jwt.sign(payload, app.get('superSecret'), {
              expiresIn: "1h"
            });
            rep.send({token : token, login : res[0].login});
          } else {
            rep.redirect('/error');
          }
          client.close();
      });
    }
  });
});

apiRoutes.post("/", function (req, rep) {
MongoClient.connect(url, function (err, client) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    // do some work here with the database.
    client.db(process.env.DB).collection("private").find({ "_id.login" : req.body.login}).toArray(function (err, res) {
        if (res.length != 0 && password_hash.verify(req.body.mot_de_passe, res[0].mdp)) {
          var payload = {
            login: req.body.login
          }
          var token = jwt.sign(payload, app.get('superSecret'), {
            expiresIn: "1h"
          });
          client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
            rep.render('secret.pug', { tableau: calculeRes(res) , token: token});
          });
        } else {
          rep.redirect('/error');
        }
        client.close();
    });
  }
});

});

apiRoutes.use(function(req, res, next) {
  var token = req.body.token || req.query.token;
  if (token) {
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {
      if (err) {
          res.redirect('/error');
      } else {
        req.decoded = decoded;
        next();
      }
      
    });
  } else {
    res.redirect('/error');
  }
});

function calculeRes(res) {
  for (var i in res) {
    var date = new Date() - new Date(res[i]._id.dateEmprunt);
    var test;
    var index = empruntPossible.indexOf(res[i].longEmprunt);
    if (index == 0) {
      test = 7;
    } else if (index == 1) {
      test = 14;
    } else {
      test = 30;
    }
    if (Math.floor(date/1000/60/60/24) < test) {
      res[i].status = false;
    } else {
      res[i].status = true;
    }
  }
  return res;
}


apiRoutes.get("/status", function (req, rep) {
  MongoClient.connect(url, function (err, client) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    // do some work here with the database.
    if (req.query.status == "Tous les prêts rendus") {
      client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}, { $match: {rendu : true}}]).toArray(function (err, res) {
        rep.render('secret.pug', { tableau: res, rendu: true, token: req.query.token });
      });
    } else if (req.query.status == "Tous les prêts en retard") {
      client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}, { $match: {rendu : false}}]).toArray(function (err, res) {
        rep.render('secret.pug', { tableau: calculeRes(res), retard: true, token: req.query.token });
      });
    } else {
      client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
        rep.render('secret.pug', { tableau: calculeRes(res), token: req.query.token });
      });
    }
  }
});
});

apiRoutes.post("/ajouterProf", function (req, rep) {
  MongoClient.connect(url, function (err, client) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    // do some work here with the database.
    if (req.body.mot_de_passe != req.body.mot_de_passe2) {
        client.db(process.env.DB).collection("rental").find([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
          rep.render('secret.pug', { tableau: calculeRes(res), mdpDiff : true, token: req.body.token });
        });
    } else {
      client.db(process.env.DB).collection("private").insertOne({ _id : {login : req.body.login}, mdp : password_hash.generate(req.body.mot_de_passe), code : hashCode(req.body.login)}, function (err) {
        if (err) {
          client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
            rep.render('secret.pug', { tableau: calculeRes(res), loginExiste : true, token: req.body.token });
          });
        } else {
          var numero = hashCode(req.body.login);
          client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
            rep.render('nouveauProf.pug', { login: req.body.login, lien: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + numero,  token: req.body.token });
          });
        }
      });
    }
  }
});
});

apiRoutes.post('/ajouter', function(req,rep) {
var now = new Date(Date.now());
var annee   = now.getFullYear();
var mois    = now.getMonth() + 1;
var jour    = now.getDate();
var date = annee+"-"+mois+"-"+jour;
var rendu = false;
if (req.body.retour == "on") {
  MongoClient.connect(url, function (err, client) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      // do some work here with the database.
      client.db(process.env.DB).collection("rental").find({
            "_id.numEtudiant" : req.body.numEtudiant,
            "numProf": hashCode(req.body.loginProf),
            "numCarte": req.body.numCarte
      }).toArray(function (err, res) {
          if (res.length == 0) {
            client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
              rep.render('secret.pug', { tableau: calculeRes(res), ajoutImpossible: true, token: req.body.token });
              client.close();
            });
          } else {
            client.db(process.env.DB).collection("rental").updateOne({
                  "_id": {
                      "numEtudiant": req.body.numEtudiant,
                      "dateEmprunt" : res[0]._id.dateEmprunt
                  },
                  "numProf": hashCode(req.body.loginProf),
                  "numCarte": req.body.numCarte,
                  "longEmprunt" : req.body.duree
            }, {
              $set: { "rendu": true }
            }, function (err) {
            });
            client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
              rep.render('secret.pug', { tableau: calculeRes(res), token: req.body.token });
              client.close();
            });
          }
      });

    }
  });
} else {
  MongoClient.connect(url, function (err, client) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      // do some work here with the database.
      client.db(process.env.DB).collection("rental").insertOne({
            "_id": {
                "numEtudiant": req.body.numEtudiant,
                "dateEmprunt": date
            },
            "numProf": hashCode(req.body.loginProf),
            "numCarte": req.body.numCarte,
            "rendu": rendu,
            "longEmprunt" : req.body.duree
      }, function (err) {
      });
      client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
        rep.render('secret.pug', { tableau: calculeRes(res), token: req.body.token });
        client.close();
      });
    }
  });
}
});

apiRoutes.post('/delete', function(req,rep) {
MongoClient.connect(url, function (err, client) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    // do some work here with the database.
    var result = client.db(process.env.DB).collection("rental").remove({
          "_id": {
            "numEtudiant": req.body.numEtudiantASupprimer,
            "dateEmprunt": req.body.dateEmpruntASupprimer
          }
          },{justOne: true}).then(function (result) {
      if (result.result.n == 0) {
        client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
          rep.render('secret.pug', { tableau: calculeRes(res), supImpossible: true, token: req.body.token });
        });
      } else {
        client.db(process.env.DB).collection("rental").aggregate([{$lookup:
       {
         from: 'private',
         localField: 'numProf',
         foreignField: 'code',
         as: 'eleve'
       }}]).toArray(function (err, res) {
          rep.render('secret.pug', { tableau: calculeRes(res), token: req.body.token });
        });
      }
    });

  }
});
});

app.get('/error', function (req, rep) {
rep.sendFile(__dirname + '/views/index.html');
});

app.get("/", function (req, rep) {
rep.sendFile(__dirname + '/views/index.html');
});

apiRoutes.post("/ajout", function (req, rep) {
var now = new Date(Date.now());
var annee   = now.getFullYear();
var mois    = now.getMonth() + 1;
var jour    = now.getDate();
var date = jour+"/"+mois+"/"+annee;
var rendu = false;
if (req.body.retour == "on") {
  MongoClient.connect(url, function (err, client) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      // do some work here with the database.
      client.db(process.env.DB).collection("rental").find({
            "_id.numEtudiant" : req.body.etudiant,
            "numProf": req.body.prof,
            "numCarte": req.body.carte,
            "longEmprunt" : req.body.duree
      }).toArray(function (err, res) {
          client.db(process.env.DB).collection("rental").updateOne({
                "_id": {
                    "numEtudiant": req.body.etudiant,
                    "dateEmprunt" : res[0]._id.dateEmprunt
                },
                "numProf": req.body.prof,
                "numCarte": req.body.carte,
                "longEmprunt" : req.body.duree
          }, {
            $set: { "rendu": true }
          }, function (err) {
            if (err) throw err;
            rep.send("OK");
          });
      });

    }
  });
} else {
  MongoClient.connect(url, function (err, client) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      // do some work here with the database.
      client.db(process.env.DB).collection("rental").insertOne({
            "_id": {
                "numEtudiant": req.body.etudiant,
                "dateEmprunt": date
            },
            "numProf": req.body.prof,
            "numCarte": req.body.carte,
            "rendu": true,
            "longEmprunt" : req.body.duree
      }, function (err) {
        if (err) throw err;
        rep.send("OK");
      });
    }
  });
}
});

var storage = multer.diskStorage({
    destination: function(req, file, callback){
        callback(null, '/tmp/');
    },
    filename: function(req, file, callback){
        callback(null, new Date().toISOString() + "-" + file.originalname);
    }
});

var upload = multer({storage: storage});

apiRoutes.get('/eleve/:numEtudiant/rendu/:status', function (req, rep) {
  MongoClient.connect(url, function (err, client) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      var rendu;
      if (req.params.status == "false") {
        rendu = false;
      } else {
        rendu = true;
      }
      // do some work here with the database.
      client.db(process.env.DB).collection("student").find({ num: req.params.numEtudiant}).toArray(function (err, res) {
        rep.render('ficheEleve.pug', { tableau: res, rendu : rendu });
        client.close();
      });
    }
  });
});

app.post('/secret/submit', upload.single('myFile'), function (req, res) {
  csvtojson()
  .fromFile(req.file.path)
  .on('json',(jsonArrayObj)=>{ //when parse finished, result will be emitted here.
    MongoClient.connect(url, function (err, client) {
      if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        // do some work here with the database.
        client.db(process.env.DB).collection("student").insertOne(jsonArrayObj, function (err) {
        });
      }
    });
  });
  res.sendFile(__dirname + '/views/index.html');
});

app.post('/secret/stats', upload.single('myFile'), function (req, res) {
  csvtojson()
  .fromFile(req.file.path)
  .on('json',(jsonArrayObj)=>{ //when parse finished, result will be emitted here.
    MongoClient.connect(url, function (err, client) {
      if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        // do some work here with the database.
        client.db(process.env.DB).collection("student").insertOne(jsonArrayObj, function (err) {
        });
      }
    });
  });
  res.sendFile(__dirname + '/views/index.html');
});

apiRoutes.post('/export', function (req, reponse) {
  MongoClient.connect(url, function (err, client) {
      if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        client.db(process.env.DB).collection("rental").find({}).toArray(function (err, res) {
          //const json2csvParser = new Json2csvParser({});
          var csv ='"Numéro Etudiant","Date d\'Emprunt","Numéro Prof","Numéro Carte","État du Rendu","Longueur Emprunt"\n';
          for (var i in res) {
            csv += "\"" + res[i]._id.numEtudiant + "\",";
            csv += "\"" + res[i]._id.dateEmprunt + "\",";
            csv += "\"" + res[i].numProf + "\",";
            csv += "\"" + res[i].numCarte + "\",";
            csv += "\"" + res[i].rendu + "\",";
            csv += "\"" + res[i].longEmprunt + "\"\n";
          }
          //const csv = json2csvParser.parse(res);
          fs.writeFile("/tmp/eazyboss.csv", csv, function(err) {
            if(err) {
              return console.log(err);
            } else {
              var file = '/tmp/eazyboss.csv';
              reponse.download(file); // Set disposition and send it. 
            }
          }); 
        });
      } 
  });

});

function hashCode(str) {
  var hash = 0, i, chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

apiRoutes.get('/stats', function (req, rep) {
  MongoClient.connect(url, function (err, client) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      client.db(process.env.DB).collection("rental").find().count(function (err, nbPrets) {
        client.db(process.env.DB).collection("rental").aggregate([
            {"$group" : {_id:"$numCarte", count:{$sum:1}}}
        ]).toArray(function (err, nbCartes) {
          client.db(process.env.DB).collection("rental").aggregate([
            {"$group" : {_id:"$longEmprunt", count:{$sum:1}}}
        ]).toArray(function (err, longueurEmprunt) {
          var moy = 0;
          var somme = 0;
          longueurEmprunt.forEach(function (unEmprunt) {
            somme += unEmprunt.count * unEmprunt._id;
          });
          moy = somme/nbPrets;
            
          rep.render('statistiques.pug', { nbPrets: nbPrets, nbCartes: nbCartes, longueurEmprunt: longueurEmprunt});
          client.close();
          });
        });
      });
    }
  });
});

app.use('/secret', apiRoutes);

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
  