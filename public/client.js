// client-side js
// run by the browser each time your view template is loaded
var CheminComplet = document.location.href;
var CheminRepertoire  = CheminComplet.substring(CheminComplet.lastIndexOf( "/" ), CheminComplet.length);
$(document).ready( function (req, res) {
  if (CheminRepertoire == "/error"){
    document.getElementById("error").innerHTML = "Vous avez rentré le mauvais mot de passe ou mauvais identifiant";
  } 
});
