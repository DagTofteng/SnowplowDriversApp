require([              
    "dojo/_base/array",
    "dojo/_base/lang",    
    "dojo/promise/all",
    "dojo/topic",
    "esri/Map",
    "esri/Basemap",
    "esri/WebMap",
    "esri/config",    
    "esri/geometry/Point",        
    "esri/geometry/ScreenPoint",        
    "esri/layers/FeatureLayer",
    "esri/views/MapView",
    "esri/widgets/ScaleBar",
    "esri/request",
    "esri/symbols/PictureMarkerSymbol",
    "esri/Graphic",
    "dojo/request/xhr",
    "esri/identity/OAuthInfo",
    "esri/identity/ServerInfo",        
    "esri/identity/IdentityManager",
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",
    "esri/widgets/Track",
    "dojo/domReady!"
], function(
    array,
    lang,        
    all,
    topic,
    Map,
    Basemap,
    WebMap,
    esriConfig,                
    Point,
    ScreenPoint,
    FeatureLayer,
    MapView,
    ScaleBar,
    esriRequest,
    PictureMarkerSymbol,
    Graphic,
    xhr,
    OAuthInfo,
    ServerInfo,
    IdentityManager,
    QueryTask, 
    Query,
    Track) {

    var mapsSharingUrl = "https://testkommune.maps.arcgis.com/sharing/rest/";
    var featureServiceUrl = "https://services.arcgis.com/PdUYt91ohJfR04kk/arcgis/rest/services/Skedsmo_Br%C3%B8yteroder_WFL1/FeatureServer/";    
    var featureServiceIDList = [0,1]; // 0 = linje, 1 = polygon
    var featureServiceTableID = [2];        
    var timestampStart;
    var timestampStop;
    var selectedRodeID;
    var selectedRodeText;
    var timer;
    var rodeArray = [];
    var view;
    var fallbackTimestampStart;
    
   
    if (localStorage.getItem("broyteAppTokenExpiration") && localStorage.getItem("broyteAppUserID")) {
        var tokenExpiration = Date.parse(localStorage.getItem("broyteAppTokenExpiration"));
        var dateNow = Date.now();
        // Gyldig tidsrom for token
        if (dateNow < tokenExpiration) {
            var token = localStorage.getItem("broyteAppToken");
            var userId = localStorage.getItem("broyteAppUserID");
            initMapAndFeatureService(token, userId);
        }
    }

    function initMapAndFeatureService(token, userId) {        
        IdentityManager.registerToken({
            server: mapsSharingUrl,
            token: token
        });
        
        getUserInfo(userId).then(t => {
            var fullname = t.data.fullName;
            $("#userInfo").text(fullname)
        });

        $("#logout").show();
        
        var map = new WebMap({
        portalItem: {
            id: "4db252250bdb46338e49f7dbfc57c661"  
            }
        });        
        view = new MapView({
            container: "map",
            map: map,                        
        });
            // Create an instance of the Track widget
        // and add it to the view's UI
        // var track = new Track({
        //     view: view
        // });
        // view.ui.add(track, "top-left");            
        // view.when(function() {
        //     track.start();
        // });
        window.map = map;

        if (localStorage.getItem("broyteAppLastRodeID")) {
            getRodeList(true);
        }
        else {        
            showStep("step2");
        }
    }

   
    function getUserInfo(userId) {
        var getUserInfoUrl = mapsSharingUrl + "community/users/" + userId;
        var token = localStorage.getItem("broyteAppToken");
        if (token) {
            var request = esriRequest(getUserInfoUrl + "?token=" + token, {
                method: 'get',
                responseType: 'json',
                query: {
                f: 'json',
                }
            });
            return request;
        }
        return null;
    }

    // Hvis bruker logger inn sjekker vi først om han har en aktiv rode som har satt i gang. Hvis ja - gå direkte hit
    function getRodeList(redirectToLocalStorageRodeID) {
        var query = new Query();
        query.returnGeometry = false;
        query.outFields = ["RodeID,RodeNavn,SisteStartTidspunkt,SisteFerdigTidspunkt,Editor"];
        query.returnDistinctValues = true;
        query.returnGeometry = false;
        query.where = "1=1";    
         
        var token = localStorage.getItem("broyteAppToken");
        var queryTaskList = [];   
        // Kjør 2 queryTasker (mot linje og polygon)
        var numberOfQueryTasksCompleted = 0;
        array.forEach(featureServiceIDList, function (id) {                       
            var queryTask = new QueryTask({
                url: featureServiceUrl + id + "?token=" + token
            });
            
            queryTaskList.push(queryTask.execute(query).then(function(results){                    
                return results;
            })); 
        });     
        all(queryTaskList).then(lang.hitch(this, function(results) {
            var rodeArray = combinePointAndPolygonData_rodeList(results);
            buildRodeListHTML(rodeArray, redirectToLocalStorageRodeID);
        }));        
    }

    function combinePointAndPolygonData_rodeList(results) {     
        rodeArray = [];  
        array.forEach(results, function (result) {
            array.forEach(result.features, function (item) {
                if (item.attributes.RodeID && item.attributes.RodeNavn) {
                    var existInArray = false;
                    for(i = 0; i < rodeArray.length; i++) {
                        if (rodeArray[i].RodeID == item.attributes.RodeID && rodeArray[i].RodeNavn == item.attributes.RodeNavn) {
                            existInArray = true;
                            break;
                        }
                    }
                    if (!existInArray) {
                        var active = false;
                        var timestampLatestStart = new Date(item.attributes.SisteStartTidspunkt);
                        var timestampLatestStop = new Date(item.attributes.SisteFerdigTidspunkt);  
                        if (timestampLatestStart.getTime() > timestampLatestStop.getTime()) {
                            active = true;
                        };
                        rodeArray.push({ RodeID: item.attributes.RodeID, RodeNavn: item.attributes.RodeNavn, Active: active, Editor: item.attributes.Editor });
                    }
                }
            });
        });
        rodeArray.sort((a,b) => (a.RodeNavn > b.RodeNavn) ? 1 : ((b.RodeNavn > a.RodeNavn) ? -1 : 0));  
        return rodeArray;
    };



    function buildRodeListHTML(data, redirectToLocalStorageRodeID) {
        var rodeListHtml = "";        
        array.forEach(data, function (rode) {
            var statusHtml = "<span class='status'></span>";
            var arrow = "<span class='arrow'><i class='fas fa-chevron-right'></i></span>";
            var statusAndArrow = "<div class='statusAndArrow'>" + statusHtml + arrow +"</div>";
            if (rode.Active) {                                  
                getUserInfo(rode.Editor).then(r => {
                    if (r.data.fullName) {         
                        var fullName = r.data.fullName;
                        var userName = r.data.username;                            

                        $("#rodeList").find("a[data-value='" + rode.RodeID + "']").find(".status").html("Brøyting pågår (" + fullName + ")");                        
                    }                    
                });              
            }
            var listHtml = "<a href='javascript:void(0)' data-text='" + rode.RodeNavn + "' data-value='" + rode.RodeID + "' class='list-group-item list-group-item-action text-left'>" + rode.RodeNavn + statusAndArrow +"</a>";
            rodeListHtml += listHtml;
        });

        $("#rodeList").html(rodeListHtml);

        if (redirectToLocalStorageRodeID) {
            var lastRodeID = localStorage.getItem("broyteAppLastRodeID");
            $("#rodeList").find("a[data-value='" + lastRodeID + "']").click();
        }
    }

  
    function getLatestDate(updateHistoryTable) {
        var query = new Query();
        query.returnGeometry = false;
        query.outFields = ["*"];
        query.returnDistinctValues = true;
        query.returnGeometry = false;
        query.where = "RodeID=" + selectedRodeID;    
        
        var token = localStorage.getItem("broyteAppToken");
        // Kjør 2 queryTasker (mot linje og polygon)
        var numberOfQueryTasksCompleted = 0;
        var queryTaskList = [];
        array.forEach(featureServiceIDList, function (id) {                       
            var queryTask = new QueryTask({
                url: featureServiceUrl + id + "?token=" + token
            });
            queryTaskList.push(queryTask.execute(query).then(function(results){    
                return results;
            }));      
        });
        all(queryTaskList).then(lang.hitch(this, function(results) {
            var latestPlowDateArray = combinePointAndPolygonData_latestDate(results);
            
            if (latestPlowDateArray.length > 0) {
                var timestampLatestStart = new Date(latestPlowDateArray[0].SisteStartTidspunkt);
                var timestampLatestStop = new Date(latestPlowDateArray[0].SisteFerdigTidspunkt);
                var timestampLatestStartReadable = timestampLatestStart.toLocaleString("nb-NO");
                var timestampLatestStopReadable = timestampLatestStop.toLocaleString("nb-NO");
                fallbackTimestampStart = new Date(latestPlowDateArray[0].SisteStartTidspunkt);
                $("#latestPlowStartDate").html(timestampLatestStartReadable);
                $("#latestPlowStopDate").html(timestampLatestStopReadable);                        
                
                if (timestampLatestStart.getTime() > timestampLatestStop.getTime()) {
                    
                    var now = new Date();    
                    timestampStart = timestampLatestStart.getTime();
                    var diff = diff_hours(timestampStart, now);  
                    $("#alertBox #alertText").html("Brøyting pågår på denne roden. <br/>Du må avslutte før du kan starte på nytt.");
                    $("#alertBox").show();
                    $("#startButton").hide();
                    $("#stopButton").show();        
                    
                    var startText = selectedRodeText + " ble startet brøytet<br/>" + timestampLatestStartReadable;
                    $("#timeInfoText").html(startText);
                    $("#counter").text(diff);
                    incrementSeconds(timestampLatestStart);
                }
                else {                
                    $("#alertBox").hide();
    
                }
                
                if (updateHistoryTable) {   
                    var resultToUse;
                    if (results[0].features.length > 0) {                
                        resultToUse = results[0];
                    }
                    else if (results[1].features.length > 0) {                
                        resultToUse = results[1];
                    }
                    else {                
                        console.log("En feil oppsto. Resultatlisten fra karttjenesten er tom");
                        return false;
                    }

                         
                    var rodeID = resultToUse.features[0].attributes.RodeID;
                    var rodeNavn = resultToUse.features[0].attributes.RodeNavn;
                    var defaultEstMinutes = resultToUse.features[0].attributes.EmpTidsforbrukMinutter;
                    updateFeatureServiceTable(rodeID, rodeNavn, timestampLatestStart, timestampLatestStop, defaultEstMinutes);
                }
            }
        }));
        
    }

    function combinePointAndPolygonData_latestDate(results) {     
        var latestPlowDateArray = [];    
        array.forEach(results, function (result) {
            array.forEach(result.features, function (item) {
            if (item.attributes.SisteStartTidspunkt) {
                var existInArray = false;
                for(i = 0; i < latestPlowDateArray.length; i++) {
                    if (latestPlowDateArray[i].SisteStartTidspunkt == item.attributes.SisteStartTidspunkt) {
                        existInArray = true;
                        break;
                    }
                }
                if (!existInArray) {
                    latestPlowDateArray.push({ SisteStartTidspunkt: item.attributes.SisteStartTidspunkt, SisteFerdigTidspunkt: item.attributes.SisteFerdigTidspunkt });
                }
                }
            });
        });
       return latestPlowDateArray;
    };
    

    $(document).on("click", "#login_btn", function () {
    // do login
    
        const Http = new XMLHttpRequest();
        var ref = window.location.origin;
        // Expiration 1440 = 1 døgn
        var url='https://www.arcgis.com/sharing/generateToken?username={0}&password={1}&referer={2}&expiration=1440&f=json';
        var un = $("#username").val();
        var pw = $("#password").val();    

        var parsedUrl = url.replace("{0}", un).replace("{1}", pw).replace("{2}", ref);

        Http.open("GET", parsedUrl);
        Http.send();
        Http.onreadystatechange=(e)=>{
            
            if (Http.responseText && Http.readyState == 4 && Http.status == 200) {
                var parsedRes = JSON.parse(Http.responseText);        
                if (parsedRes && parsedRes.token) {
                    localStorage.setItem("broyteAppToken", parsedRes.token);   
                    var expiration = new Date();
                    expiration.setHours(expiration.getHours() + 12)
                    localStorage.setItem("broyteAppTokenExpiration", expiration);   
                    localStorage.setItem("broyteAppUserID", un);   

                    initMapAndFeatureService(parsedRes.token, un);        
                    
                                        
                }
                else {
                    $("#loginText").text("Brukernavn og/eller passord stemmer ikke.")
                }
            }
           
        }
    
    });

    $(document).on("click", "#logout", function (e) {
        
        localStorage.clear();
        IdentityManager.destroyCredentials();
        $("#userInfo").text("");        
        $("#logout").hide();
        showStep("step1");
        window.location.reload();
    });

    $(document).on("click", "#rodeList a", function (e) {
        var newValueText = $(this).data("text");
        var newValueID = $(this).data("value");
        if (newValueID) {        
            selectedRodeText = newValueText;
            selectedRodeID = newValueID;
            showStep("step3");
            $("#timeInfoText").html("");
            localStorage.setItem("broyteAppLastRodeID", newValueID);    
            $("#choosenRode").html(newValueText);
            showStep("step3");    

            showRodeOnMap(selectedRodeID);
        }
        else {        
            selectedRodeText = null;
            selectedRodeID = null;
        }
        
    });

    $(document).on("click", "#changeRode", function (e) {                    
        showStep("step2");
    });

    $(document).on("click", "#startButton", function () {
        
        $("#startButton").hide();
        $("#stopButton").show();        
        
        timestampStart = Date.now();
        var timestampStartReadable = new Date(timestampStart).toLocaleString("nb-NO");
        
        var startText = selectedRodeText + " ble startet brøytet<br/>" + timestampStartReadable;
        $("#latestPlowStartDate").html(timestampStartReadable);
        $("#timeInfoText").html(startText);
        $("#counter").text("00:00:00");
        incrementSeconds(timestampStart);
        updateFeatureService(selectedRodeID, "SisteStartTidspunkt", false);

    });
    $(document).on("click", "#stopButton", function (e) {
        $("#startButton").show();
        $("#stopButton").hide();
        timestampStop = Date.now();        
        var timestampStopReadable = new Date(timestampStop).toLocaleString("nb-NO");
        var totalTimeReadable = diff_hours(timestampStart, timestampStop);    
        var stopText = selectedRodeText + " ble avsluttet<br/>" + timestampStopReadable + "<br><br>Tid brukt: " + totalTimeReadable;
        $("#timeInfoText").html(stopText);    
        
        var numberOfMs = (timestampStop - timestampStart);
        var numberOfSeconds = Math.floor(numberOfMs/1000);
        // Lagrer ikke stoptidspunkt hvis det har gått under 10 sek.
        if (numberOfSeconds < 10) {
            $("#alertBox #alertText").html("Brøytinger under 10 sekunder logges ikke.");
            $("#alertBox").show();
            // Rollback startTime
            updateFeatureService(selectedRodeID, "SisteStartTidspunkt", true);  
        }
        else 
        {
            // Probably a real click.
            if(e.hasOwnProperty('originalEvent')) {
                updateFeatureService(selectedRodeID, "SisteFerdigTidspunkt", false);  
            }             
        }    
        
    });

    $(document).on("click", "#mapToggleButton", function () {
        $("#showMap").toggle();
        $("#hideMap").toggle();
        $("#map").toggle();
        $("body").height(window.innerHeight - 150);
        
    });


    function showRodeOnMap(rodeId) {
        // Filterer ut de to featureLayersene (line og polygon) som skal filterers og vises i kart
        // "Skedsmo_Brøyteroder_WFL1_6521"
        // "Skedsmo_Brøyteroder_WFL1_9515"
        var layers = window.map.allLayers.filter(function(layer) {
            return layer.id.indexOf("Skedsmo_Brøyteroder") > -1;
        });
        array.forEach(layers.items, function (layer) {            
            layer.definitionExpression = "RodeID='" + rodeId + "'";             
            layer.queryExtent().then(function(results){
                // go to the extent of the results satisfying the query
                if (results && results.extent) {
                    setTimeout(() => {
                        view.goTo(results.extent);    
                    }, 500);
                    
                }            
              });
        });
    }
    

    function diff_hours(startTime, stopTime) 
    {
        var diffInMs = stopTime - startTime;    

        var seconds = diffInMs / 1000;
        var hours = parseInt( seconds / 3600 ); 
        seconds = seconds % 3600; 
        var minutes = parseInt( seconds / 60 ); 
        seconds = Math.floor(seconds % 60);

        if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}
        var outputTime = hours+':'+minutes+':'+seconds;
        return outputTime;        
    }

    function incrementSeconds(startTime) {
        var seconds = 0;

        if (timer) {
        clearInterval(timer);
        }
        
        timer = setInterval(function () {
            var counter = diff_hours(startTime, Date.now())
            $("#counter").text(counter);
            seconds++;
        }, 1000);   
        
    }

    function showStep(id) {
        $("#step1").hide();
        $("#step2").hide();
        $("#step3").hide();
        $("#" + id).show();

        if (id == "step2") {
             // Get unique Rodelist with status
            getRodeList(false);      
        }

        // 3 = Vis valgt rute med evt Playbutton. Hent opp sist-måkt dato.
        if (id == "step3") {
            $("#startButton").show();
            $("#stopButton").hide();
            getLatestDate(false);
        }
    }

    function updateFeatureService(rodeId, fieldToUpdate, rollbackStarttime) {
        var query = new Query();    
        query.returnGeometry = true;    
        query.outFields = ["*"];        
        query.where = "RodeID=" + rodeId; 
        
        var token = localStorage.getItem("broyteAppToken");
        var date = Date.now();  
        if (rollbackStarttime){
            date = fallbackTimestampStart;
            var timestampStartReadable = new Date(fallbackTimestampStart).toLocaleString("nb-NO");
            $("#latestPlowStartDate").html(timestampStartReadable);
        }
        var featureTaskAll = []; 
        var applyAll = []; 
          
        array.forEach(featureServiceIDList, function (id) {              
            var queryTask = new QueryTask({
                url: featureServiceUrl + id + "?token=" + token
            });        
            
            featureTaskAll.push(queryTask.execute(query).then(function(results){   
                var layer = window.map.allLayers.find(function(layer) {
                    return layer.layerId === id;
                });
                var updateFeatures = [];
                
                array.forEach(results.features, function(rode) {  
                    var obj = rode;                
                    obj.attributes[fieldToUpdate] = date;      
                    const updateFeature = new Graphic();
                    updateFeature.attributes = obj.attributes;
                    updateFeature.geometry = obj.geometry;
                    // Hvis ikke objektet har geometeri klarer vi ikke å oppdatere de. TODO: Fikse datagrunnlaget.
                    if (obj.geometry) {
                        updateFeatures.push(updateFeature);
                    }
                });

                var returnObj = { 
                    layer: layer,
                    updateFeature: updateFeatures
                }

                return returnObj;
            }));
            
        
        all(featureTaskAll).then(lang.hitch(this, function(results) {
            // Når bruker klikker på stopp - vil vi overføre start og stopp tidspunkter til historikktabellen. 
            // Men vi fjerner de ikke fra featureServicen da visualisering i kart bruker tidspunkt-feltene. 
            // Når bruker derimot klikker "start" neste gang blir de overskrevet i featureservicen.
            // if (fieldToUpdate == "SisteFerdigTidspunkt") { 
            //     getLatestDate(true);
            // }

            array.forEach(results, lang.hitch(this, function(result) {
                applyAll.push(result.layer.applyEdits({ "updateFeatures": result.updateFeature}));
                all(applyAll).then(lang.hitch(this, function(result) {
                    if (fieldToUpdate == "SisteFerdigTidspunkt") { 
                        getLatestDate(true);
                    } 
                }));
            }));
        }));
    })
}   
    function updateFeatureServiceTable(rodeId, rodeNavn, timestampStart, timestampStop, defaultEstMinutes) {          
        var numberOfMs = (timestampStop - timestampStart);
        var numberOfSeconds = Math.floor(numberOfMs/1000);
        if (numberOfSeconds < 10) {
            // do nothing
        }        
        else {
            var numberOfMinutes = Math.floor(numberOfSeconds/60);
            // Hvis over 36000 = 10t 
            
            if (numberOfSeconds > 36000) {
                $("#alertBox #alertText").html("Brøytingen tok over 10 timer. Vi tror du glemte å skru den av, og har derfor estimert tiden.");
                $("#alertBox").show();
                timestampStop = timestampStart;
                timestampStop.setMinutes(timestampStart.getMinutes() + defaultEstMinutes);
                numberOfMinutes = defaultEstMinutes;
            }
            var token = localStorage.getItem("broyteAppToken");            
            var url = featureServiceUrl + featureServiceTableID + "/applyEdits?token=" + token
            var obj = [
                { 
                    "attributes": {                 
                        RodeID: rodeId, 
                        RodeNavn: rodeNavn,               
                        SisteStartTidspunkt: timestampStart,
                        SisteFerdigTidspunkt: timestampStop,
                        FaktiskTidsforbrukMin: numberOfMinutes
                    }            
                }
            ];
            var objJson = JSON.stringify(obj);
            if (token) {
                var request = esriRequest(url, { 
                    responseType: 'json',
                    method: 'post',
                    query: {                     
                        adds: objJson,
                        token: token,
                        f: 'json'
                    }
                });

                request.then(function(response) {
                    var test = response;
                });            
            }
        }
        return null;
            // Koden under er enda ikke støttet i ArcGIS JS 4.10. Men vil etterhvert...
            // var addFeatures = [];
            // const addFeature = new Graphic();
            // addFeature.attributes = attr;
            // addFeatures.push(addFeature);            
            // const promise = layer.applyEdits({addFeatures: addFeatures}).then(function(result){             
            //     var test = result;
            // });          
    }
    
});