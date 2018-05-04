$(document).ready(function(){
    $('select').formSelect();
  });

function click_emprunt() {
    document.getElementById("duree").hidden = false;
    document.getElementById("retour").value = 'off';
}

function click_retour() {
    document.getElementById("duree").hidden = true;
    document.getElementById("retour").value = 'on';
}