/*	Main Process */
"use strict";

// Global Variable
var Conf = {};					// Config Praams
const GTAG = '<script async src="https://www.googletagmanager.com/gtag/js?id=';
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const FILES = [
	"./baselist.html", "./data/config.jsonc", './data/config-system.json', './data/config-activities.json',
	`./data/marker.json`, `./data/category-${LANG}.json`, `data/listtable-${LANG}.json`,
	`./data/glot-custom.json`, `data/glot-system.json`, './data/overpass-system.json', `./data/overpass-custom.json`];
const glot = new Glottologist();
var gSheet = new GoogleSpreadSheet();
var cMapmaker = new CMapMaker();
var modal_takeout = new modal_Takeout();
var modal_activities = new modal_Activities();
var modal_wikipedia = new modal_Wikipedia();
var basic = new Basic();
var leaflet = new Leaflet();

// initialize
console.log("Welcome to MapMaker.");
window.addEventListener("DOMContentLoaded", function () {
	let jqXHRs = [];
	for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
	$.when.apply($, jqXHRs).always(function () {
		let basehtml = arguments[0][0];												// Get Menu HTML
		Conf = JSON5.parse(arguments[1][0]);
		for (let i = 2; i <= 6; i++) Conf = Object.assign(Conf, arguments[i][0]);	// Make Config Object
		Conf.category_keys = Object.keys(Conf.category);							// Make Conf.category_keys
		Conf.category_subkeys = Object.keys(Conf.category_sub);						// Make Conf.category_subkeys
		glot.data = Object.assign(glot.data, arguments[7][0]);						// import glot data
		glot.data = Object.assign(glot.data, arguments[8][0]);						// import glot data
		Conf = Object.assign(Conf, arguments[9][0]);								// import OverPass
		Conf.osm = Object.assign(Conf.osm, arguments[10][0].osm);					// import OverPass
		window.onresize = winCont.window_resize;    // 画面サイズに合わせたコンテンツ表示切り替え
		// document.title = glot.get("title");		// Title(no change / Google検索で日本語表示させたいので)
		cMapmaker.init(basehtml);					// Mapmaker Initialize
		if (Conf.google.Analytics !== "") {			// Google Analytics
			let AnalyticsURL = GTAG + Conf.default.GoogleAnalytics + '"></script>';
			document.getElementsByTagName('head').insertAdjacentHTML("beforeend", AnalyticsURL);
			window.dataLayer = window.dataLayer || [];
			function gtag() { dataLayer.push(arguments); };
			gtag('js', new Date());
			gtag('config', Conf.google.Analytics);
		};
	});
});
