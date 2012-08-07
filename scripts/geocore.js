const CHECK_INTERVAL = 10*1000;//10 sec
const REFRESH_INTERVAL = 10*1000;//10 sec
const RADAR_ZONE_RADIUS_1 = 500; //m
const RADAR_ZONE_RADIUS_2 = 100; //m
const RADAR_ZONE_RADIUS_3 = 2000; //m
const RADAR_ZONE_RADIUS_4 = 2500; //m

var distances = null;
var closestPoint = null;
var serverData = null;
var currentPosition = null;
var closestDistance = -1;
var lastNotificationType = 0;
var checkTimer = null;
var refreshTimer = null;
var notificationElementID = "";
var aud = null;

// Blinks a piece of text
function blink(selector){ 
	$(selector).fadeOut('slow', function(){ 
		$(this).fadeIn('slow', function(){ 
			blink(this); 
		}); 
	}); 
} 

// Check the closest point and notify the user
function checkClosestPoint(){   
	if(closestDistance < 0) return;
    if(closestDistance < RADAR_ZONE_RADIUS_1){
        notify(1);return;
    }
    if(closestDistance < RADAR_ZONE_RADIUS_2){
        notify(2);return;
    }
    if(closestDistance < RADAR_ZONE_RADIUS_3){
        notify(3);return;
    }
    if(closestDistance < RADAR_ZONE_RADIUS_4){
        notify(4);return;
    }
    notify(0);
}

function onsuccess(position){
	currentPosition = new Object();
    currentPosition.latitude = degreesToRads(position.coords.latitude);
    currentPosition.longitude = degreesToRads(position.coords.longitude);    
    currentPosition.timestamp = position.timestamp;

	var rounded = closestDistance;
	rounded.toFixed(0);
	// show the current position and the closest distance
    $('#message').html('Latitude: ' + radsToDegrees(currentPosition.latitude) + '<br />' + 'Longitude: ' + radsToDegrees(currentPosition.longitude) + '<br/>' +  'Timestamp: ' + position.timestamp + '<br />Closest point: ' + rounded + '</br>');   		
	
	computeDistances();
}
function onerror(error) {        
    alert('Eroare citire date GPS: ' + error.message + '\n Cod eroare:' + error.code);    
}
// Refresh the current location in RADIANS
function processData(){
    navigator.geolocation.getCurrentPosition(onsuccess, onerror);
}

// Sync with server
function refreshData(type){    	
    var id = device.uuid;
    //if(device != null) id = device.uuid;
	if(type === undefined){
	    syncWithServer(currentPosition, 0, id);
	}else{
	    syncWithServer(currentPosition, type, id);
	}
}
function startTimer(){
    if(checkTimer != null) return;
	alert('Starting timer every' + CHECK_INTERVAL);
	checkTimer = setInterval(processData, CHECK_INTERVAL);
	refreshTimer = setInterval(refreshData, REFRESH_INTERVAL);
	alert('Timer started');
}
function stopTimer(){
	clearInterval(checkTimer);
	clearInterval(refreshTimer);
}

// Convert degrees into RADIANS
function degreesToRads(val) {
    return val * Math.PI / 180;
}
// Convert RADIANS to degrees 
function radsToDegrees(val){
    return val * 180/Math.PI;

}
// Compute distance between 2 points based on geo params in RADIANS
function computeDistance(p1, p2) {
    var R = 6371000; // m
    var d = Math.acos(Math.sin(p1.latitude) * Math.sin(p2.latitude) +
                  Math.cos(p1.latitude) * Math.cos(p2.latitude) *
                  Math.cos(p2.longitude - p1.longitude)) * R;
    return d;
}
// Calculate the distances between the current position and the points retrieved from the server; it also identifies the closest point
function computeDistances() {
    if (serverData == null) return;
    var firstReading = false;
    if (distances == null) {
        distances = new Array(serverData.length);
        for (var index = 0; index < serverData.length; index++) distances[index] = 0;        
        firstReading = true;
    }
    //alert(serverData.length);
    for (var index = 0; index < serverData.length; index++) {
        var currentDistance = computeDistance(currentPosition, serverData[index]);
        if(firstReading && index == 0){
            closestPoint = serverData[0];        
            closestDistance = currentDistance;            
        }
        // get the absolute distance from the point
        var oldDistance = distances[index] < 0 ? -distances[index] : distances[index];
        // if 0, set the new distance
        if(oldDistance == 0){
            distances[index] = currentDistance;
        }else{
            // if approaching that point, set a positive distance
            if(oldDistance > currentDistance){
                distances[index] = currentDistance;
            }else{
                // if moving further away, set a negative distance
                distances[index] = -currentDistance;
            }
        }

        if ((distances[index] >= 0) && (distances[index] < closestDistance)) {
            closestDistance = distances[index];
            closestPoint = serverData[index];
        }        
    }
    // check the closest point
    checkClosestPoint();		
    //alert(closestDistance + 'lat: '+ closestPoint.latitude + 'long: ' + closestPoint.longitude);
}
function notify(type) {
    if (type < 0 || type > 4) return;
    var message = "";
    switch (type) {
        case 4: message = 'Zona radar in 2 KM'; break;
        case 3: message = 'Zona radar in 1 KM'; break;
        case 2: message = 'Zona radar in 500 m'; break;
        case 1: message = 'Radar ! Mergeti incet urmatorii 1-2 KM'; break;//aud.src = "demo.mp3"; aud.play(); break;
        default:break;
    }
    if(lastNotificationType != type && type == 1){
        if(aud != null){
            aud.stop();
        }else{
            aud = new Media("/android_asset/www/radar.mp3");
        }
        aud.play();         
    }
    lastNotificationType = type;
    if(notificationElementID != null && message.length > 0){
        $('#message').html(message);
    }
	if(type == 1){
		blink('#message');
	}
    return message;
}
function syncWithServer(position, type, deviceID) {
    if(position == null) return;
	var msg = "http://mail.temasoft.ro:83?latitude=" + radsToDegrees(position.latitude) + "&longitude=" + radsToDegrees(position.longitude) + "&type=" + type + "&deviceID=" + deviceID;
	//alert('sending data to server:' +msg );
    var req = new XMLHttpRequest();
    req.open("POST", msg);
    req.onreadystatechange = function () {
        if (req.readyState == 4 && req.status == 200) {
			//alert(req.getResponseHeader("content-type"));
            if (req.getResponseHeader("content-type").match(/text[/]javascript/)) {
                //alert('got server data');
                var lowerResponse = req.responseText.toLowerCase();               
                serverData = JSON.parse(lowerResponse);
				distancese = null;
                //alert(lowerResponse);
                //computeDistances();                
            }
        }
    }
    req.onerror = function(error){
        alert('Eroare citire date de la server: ' + error.message + '\n Cod eroare:' + error.code); 
    }
	//alert('sent data to server');
    req.send(null);
}
function point2() {
    currentPosition = new Object();
    currentPosition.latitude = degreesToRads(45.76275647);
    currentPosition.longitude = degreesToRads(23.598022);
    //computeDistances();
}

function test2(){
    alert('t2');
}
function test1() {
    
    //var a = new Media("http://audio.ibeat.org/content/p1rj1s/p1rj1s_-_rockGuitar.mp3");
	//var a = new Media("/android_asset/www/demo.mp3");
    //if (!a.canPlayType("audio/mpeg")) akert("cannot play");
    //else a.play();
	//a.play();
    
    var pos = new Object();
    pos.coords = new Object();
    pos.coords.latitude = degreesToRads(45.7665647);
    pos.coords.longitude = degreesToRads(23.5985675);
    //syncWithServer(pos, 1);
    currentPosition = new Object();
    currentPosition.latitude = degreesToRads(45.4675647);
    currentPosition.longitude = degreesToRads(23.6122);
    
}