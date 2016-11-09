// ==UserScript==
// @name        Nyne Operator
// @author      Marco (Nouveau)
// @namespace   http://jefaisdestrucs.pe.hu/Nyne/
// @description L'opérateur Nyne est votre bras droit dans ce monde brutal.
// @include     http://nyne.oriic.org/*
// @include     http://www.nyne.oriic.org/*
// @version     0.2
// @updateURL   http://jefaisdestrucs.pe.hu/Nyne/operator.user.js
// @connect     jefaisdestrucs.pe.hu/Nyne/*
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js
// @grant       GM_xmlhttpRequest
// ==/UserScript==

/* SideStatus definit l'état de l'écran de droite */
var SideStatusPossible = ["Inconnu", "EspionnageAcheve", "OrdreFlotte"];
var SideStatus = SideStatusPossible[0];
/* MainStatus représente l'écran centrale */
var MainStatusPossible = ["Inconnu", "Flottes"];
var MainStatus = MainStatusPossible[0];
/* ColonieUpdated est le tableau des colonies déjà mis à jour */
var ColonieUpdated = [];

/* Boucle infinie, analyse la page toutes les 2000 millisecondes (2 sec) */
waitForElementToDisplay("#side",2000);

function waitForElementToDisplay(selector, time)
{
  if(document.querySelector(selector) !== null)
  {
    /* Recherche de l'écran centrale et celui de droite */
    var main = document.getElementById("main").children;
    var side = document.getElementById("side").children;

    /* Analyse des deux écrans */
    analyseSide(side);
    analyseMain(main);

    /* Effectue des taches en fonction de l'analyse (page trouvee) */
    if (SideStatus == SideStatusPossible[1] && MainStatus == MainStatusPossible[1])
    {
      traitementEspionnage(side, main);
    }
    else if (SideStatus == SideStatusPossible[2])
    {
      var form = document.getElementById("send");
      traitementAffichageCible(form);
    }

    //return;
  }

    setTimeout(function()
    {
      waitForElementToDisplay(selector, time);
    }, time);
}

function traitementAffichageCible(form)
{
  // La derniere condition verifie que le joueur n'est pas deja modifie par le script, les autres verifient que c'est bien la bonne page.
  if (form.childNodes[1].childNodes[0].childNodes[2].childNodes[0].innerHTML.toUpperCase() == "CIBLE" &&
     form.childNodes[1].childNodes[0].childNodes[2].childNodes[1].innerHTML.length >= 6 &&
     !form.childNodes[1].childNodes[0].childNodes[2].childNodes[1].innerHTML.endsWith("//"))
  {
    /* La cible est un joueur (meme lune ou differente) */
    var cible = form.childNodes[1].childNodes[0].childNodes[2].childNodes[1].innerHTML.toUpperCase();

    // Envoie une requete au serveur
    GM_xmlhttpRequest({
      method: 'GET',
      url: 'http://jefaisdestrucs.pe.hu/Nyne/infoColonie.php?playerName='+cible,
      headers: {
          'User-agent': 'Mozilla/4.0 (compatible) Greasemonkey',
          'Accept': 'application/atom+xml,application/xml,text/xml',
      },
      onload: function(responseDetails)
      {
        // utilisation du resultat de la requete
        if (responseDetails.responseText.length > 6)
          ajoutPuissanceCible(form,dechiffrerInfoJoueur(responseDetails.responseText));
      }
    });
  }
}

function dechiffrerInfoJoueur(response)
{
  // Premier element = caractere separateur
  // on prend tous les elements separes sauf le premier qui sera donc vide
  var infos = [];
  var caracSeparateur = response[0];
  infos = response.split(caracSeparateur);
  infos.shift();
  return infos;
}

function ajoutPuissanceCible(form, infos)
{
  var affPseudo = form.childNodes[1].childNodes[0].childNodes[2].childNodes[1];
  var affDate = infos[3];
  var dateReel = new Date(infos[3]);
  var dateNow = new Date(Date.now());

  if (dateNow.toDateString() == dateReel.toDateString())
    affDate = dateReel.getHours()+'h'+dateReel.getMinutes();
  else if (dateNow.getFullYear() == dateReel.getFullYear() && dateNow.getMonth() == dateReel.getMonth() && dateNow.getUTCDate()-1 == dateReel.getUTCDate())
    affDate = 'Hier';
  else
    affDate = (dateDiff(dateReel, dateNow).day+1 + ' jours.');

  affPseudo.innerHTML += ' (P'+infos[1]+') exo: '+infos[2]+'  : '+affDate+' //';
}

/* Envoie un espionnage a la BDD */
function traitementEspionnage(side, main)
{
  var pseudoColonie = side[5].childNodes[0].childNodes[0].childNodes[1].childNodes[0].innerHTML;

  if(contains(ColonieUpdated,pseudoColonie)) /* Legere opti */
    return;

  var puissance = side[5].childNodes[0].childNodes[1].childNodes[1].childNodes[0].innerHTML;
  var exo = side[5].childNodes[0].childNodes[3].childNodes[0].childNodes[0].childNodes[1].innerHTML.split("<br>")[1];
  var etatColonie = side[5].childNodes[0].childNodes[4].childNodes[1].childNodes[0].childNodes[0].innerHTML;
  var flotte = side[2].childNodes[0].childNodes[0].childNodes[1].innerHTML;
  var lune = main[2].childNodes[1].childNodes[0].childNodes[0].childNodes[4].childNodes[flotteToNumber(flotte)].childNodes[0].childNodes[0].innerHTML;

  // Prise en compte de l'etat de la colonie dans le calcul de la puissance
  etatColonie = (Math.floor(etatColonie.split("%")[0].split(",")[0])/100)*puissance;

  // Si jamais rajouté, alors on le rajoute
  updateDatabase(pseudoColonie, puissance, exo, lune);
}

/* Analyse l'ecran centrale */
function analyseMain(main)
{
  // reinitialise a 0.
  MainStatus = MainStatusPossible[0];
  if (main.length > 1 && main[1].innerHTML == "Flottes")
    MainStatus = MainStatusPossible[1];
}

/* Analyse l'ecran de droite */
function analyseSide(side)
{
  /* 8 enfants = Page Nyne News Network ou Rapport combat.
     7 enfants = espionnage venant d'être termine.
     1 enfant  = Ordre % : Flotte sélectionne.
  */
  SideStatus = SideStatusPossible[0];

  if (side.length == 1)
  {
      if (side[0].childNodes[0].innerHTML.startsWith("ORDRE "))
        SideStatus = SideStatusPossible[2];
  }
  else if (side.length == 7)
  {
    if (side[0].innerHTML == "Espionner" && side[3].innerHTML == "Achevé.")
      SideStatus = SideStatusPossible[1];
  }
}

/* Mise a jour de la database */
function updateDatabase(nomColonie, puissance, exo, lune)
{
  ColonieUpdated.push(nomColonie);
  var xhr = getXMLHttpRequest();
  xhr.open('GET', 'http://jefaisdestrucs.pe.hu/Nyne/ajouter.php?playerName='+nomColonie+'&p='+puissance+'&exo='+exo+'&lune='+lune);
  xhr.send(null);
}

/* Obtenir un numero a partir de la lettre de la flotte (by Codrer) */
function flotteToNumber(flotte) { return flotte.charCodeAt(0)-65 ; }

/* Not all browser support some methods so... */
function contains(tableau, contenu)
{
    return tableau.indexOf(contenu) !== -1;
}

if (!String.prototype.startsWith)
{
  String.prototype.startsWith = function (searchString, position)
  {
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
    var subjectString = this.toString();
    if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
      position = subjectString.length;
    }
    position -= searchString.length;
    var lastIndex = subjectString.lastIndexOf(searchString, position);
    return lastIndex !== -1 && lastIndex === position;
  };
}

function getXMLHttpRequest()
{
  var xhr = null;

  if (window.XMLHttpRequest || window.ActiveXObject)
  {
    if (window.ActiveXObject)
    {
      try
      {
        xhr = new ActiveXObject("Msxml2.XMLHTTP");
      } catch(e) {
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
      }
    }
    else
    {
      xhr = new XMLHttpRequest();
    }
  }
  else
  {
    alert("Votre navigateur ne supporte pas l'objet XMLHTTPRequest...");
    return null;
  }
  return xhr;
}

function dateDiff(date1, date2)
{
  /*http://www.finalclap.com/faq/88-javascript-difference-date*/
  var diff = {};                           // Initialisation du retour
  var tmp = date2 - date1;

  tmp = Math.floor(tmp/1000);             // Nombre de secondes entre les 2 dates
  diff.sec = tmp % 60;                    // Extraction du nombre de secondes

  tmp = Math.floor((tmp-diff.sec)/60);    // Nombre de minutes (partie entière)
  diff.min = tmp % 60;                    // Extraction du nombre de minutes

  tmp = Math.floor((tmp-diff.min)/60);    // Nombre d'heures (entières)
  diff.hour = tmp % 24;                   // Extraction du nombre d'heures

  tmp = Math.floor((tmp-diff.hour)/24);   // Nombre de jours restants
  diff.day = tmp;

  return diff;
}
