class CMapMaker {

	constructor() {
		this.status = "initialize";
		this.detail = false;				// detail_view表示中はtrue
		this.open_osmid = "";
		this.last_modetime = 0;
	};

	init(basehtml) {	// Initialize
		winCont.window_resize();			// Set Window Size(mapidのサイズ指定が目的)
		winCont.splash(true);

		Promise.all([
			gSheet.get(Conf.google.AppScript), static_load(), leaflet.init()	// get_zoomなどleafletの情報が必要なためleaflet.init後に実行
		]).then(results => {
			// leaflet add control
			leaflet.controlAdd("bottomleft", "zoomlevel", "");
			leaflet.controlAdd("topleft", "baselist", basehtml, "leaflet-control m-1");			// Make: base list
			leaflet.controlAdd("bottomright", "global_status", "", "text-information");	// Make: progress
			leaflet.controlAdd("bottomright", "global_spinner", "", "spinner-border text-primary d-none");
			leaflet.locateAdd();
			if (!Conf.listTable.playback.view) list_playback_control.style.display = "none";	// playback control view:true/false

			// mouse hover event(baselist mouse scroll)
			baselist.addEventListener("mouseover", () => { map.scrollWheelZoom.disable(); map.dragging.disable() }, false);
			baselist.addEventListener("mouseleave", () => { map.scrollWheelZoom.enable(); map.dragging.enable() }, false);

			poiCont.set_actjson(results[0]);
			winCont.window_resize();
			listTable.init();
			listTable.make_category(Conf.listTable.targets);				// set select list
			cMapmaker.mode_change("map");									// initialize last_modetime
			winCont.menu_make(Conf.menu, "main_menu");
			glot.render();
			cmap_events.init();
			cmap_events.map_move().then(() => {
				winCont.splash(false);
				if (location.search !== "") {    	// 引数がある場合
					let search = location.search.replace(/[?&]fbclid.*/, '').replace(/%2F/g, '/');  // facebook対策
					let params = search.replace('-', '/').replace('=', '/').slice(1).split('&');	// -= -> / and split param
					history.replaceState('', '', location.pathname + search + location.hash);
					for (const param of params) {
						let key = param.split('/')[0];
						let value = param.split('/')[1];
						switch (key) {
							case "category":
								listTable.select_category(value);
								cmap_events.category_change();
								break;
							case "node":
							case "way":
							case "relation":
								let subparam = param.split('.');												// split child elements(.)
								cMapmaker.detail_view(subparam[0], subparam[1]);
								break;
						};
					};
				};
			}).catch(() => {
				console.log("error");
			});
			console.log("cmapmaker: initial end.");
		});

		function static_load() {	// check static osm mode
			return new Promise((resolve, reject) => {
				if (!Conf.static.mode) {		// static mode以外は即終了
					resolve("no static mode");
				} else {
					$.ajax({ "type": 'GET', "dataType": 'json', "url": Conf.static.osmjson, "cache": false }).done(function (data) {
						let ovanswer = OvPassCnt.set_osmjson(data);
						poiCont.add_geojson(ovanswer);
						resolve(ovanswer);
					}).fail(function (jqXHR, statusText, errorThrown) {
						console.log(statusText);
						reject(jqXHR, statusText, errorThrown);
					});;
				}
			})
		}
	}

	licence() {			// About license
		let msg = { msg: glot.get("licence_message") + glot.get("more_message"), ttl: glot.get("licence_title") };
		winCont.modal_open({ "title": msg.ttl, "message": msg.msg, "mode": "close", callback_close: winCont.modal_close, "menu": false });
	}

	mode_change(mode) {	// mode change(list or map)
		if (this.status !== "mode_change" && (this.last_modetime + 300) < Date.now()) {
			this.status = "mode_change";
			let params = { 'map': ['down', 'remove', 'start'], 'list': ['up', 'add', 'stop'] };
			mode = !mode ? (list_collapse.classList.contains('show') ? 'map' : 'list') : mode;
			console.log('mode_change: ' + mode + ' : ' + this.last_modetime + " : " + Date.now());
			list_collapse_icon.className = 'fas fa-chevron-' + params[mode][0];
			list_collapse.classList[params[mode][1]]('show');
			this.last_modetime = Date.now();
			this.status = "normal";
			mapid.focus();
		};
	}

	poi_view(targets) {		// Poiを表示させる
		console.log("cMapmaker: PoiView");
		targets = targets[0] == "-" ? Conf.targets : targets;	// '-'はすべて表示
		let poiview = map.getZoom() >= Conf.default.iconViewZoom ? true : false;
		let actonly = (map.getZoom() >= Conf.default.act_iconViewZoom && poiview == false) ? true : false;
		poiMarker.all_clear();
		if (poiview) targets.forEach(key => poiMarker.set(key, actonly));
	}

	poi_get(targets) {		// OSMとGoogle SpreadSheetからPoiを取得してリスト化
		return new Promise((resolve) => {
			console.log("cMapmaker: PoiGet start");
			winCont.spinner(true);
			var keys = (targets !== undefined && targets !== "") ? targets : Object.values(Conf.targets);
			if ((map.getZoom() < Conf.default.iconViewZoom) && !Conf.static.mode) {
				winCont.spinner(false);
				console.log("cMapmaker: poi_get end(more zoom).");
				resolve({ "update": true });
			} else {
				OvPassCnt.get(keys, status_write).then(ovanswer => {
					winCont.spinner(false);
					poiCont.add_geojson(ovanswer);
					console.log("cMapmaker: poi_get end(success).");
					global_status.innerHTML = "";
					resolve({ "update": true });
				}).catch(() => {
					winCont.spinner(false);
					console.log("cMapmaker: poi_get end(overror). ");
					global_status.innerHTML = "";
					resolve({ "update": false });
				});
			};
		});

		function status_write(progress) {
			global_status.innerHTML = progress;
		}
	}

	qr_add(target, osmid) {			// QRコードを表示
		let marker = poiMarker.get(target, osmid);
		if (marker !== undefined) {
			let wiki = marker.mapmaker_lang.split(':');
			let url = encodeURI(`https://${wiki[0]}.${Conf.osm.wikipedia.domain}/wiki/${wiki[1]}`);
			let pix = map.latLngToLayerPoint(marker.getLatLng());
			let ll2 = map.layerPointToLatLng(pix);
			basic.getWikipedia(wiki[0], wiki[1]).then(datas => poiMarker.qr_add(target, osmid, url, ll2, datas[0]));
		};
	}

	detail_view(osmid, openid) {	// PopUpを表示(marker,openid=actlst.id)
		const detail_close = () => {
			let catname = list_category.value !== "-" ? `?category=${list_category.value}` : "";
			winCont.modal_close();
			history.replaceState('', '', location.pathname + catname + location.hash);
			cMapmaker.open_osmid = "";
			cMapmaker.detail = false;
		};
		if (cMapmaker.detail) detail_close();
		let osmobj = poiCont.get_osmid(osmid);
		let tags = osmobj == undefined ? { "targets": [] } : osmobj.geojson.properties;
		tags["*"] = "*";
		let target = osmobj == undefined ? "*" : osmobj.targets[0];
		let category = poiCont.get_catname(tags);
		let title = "", message = "";
		for (let i = 0; i < Conf.osm[target].views.length; i++) {
			if (tags[Conf.osm[target].views[i]] !== void 0) {
				title = `<img src="./${Conf.icon.path}/${poiMarker.get_icon(tags)}">${tags[Conf.osm[target].views[i]]}`;
				break;
			}
		}
		if (title == "") title = category[0];
		if (title == "") title = glot.get("undefined");
		winCont.menu_make(Conf.detail_menu, "modal_menu");
		winCont.modal_progress(0);
		cMapmaker.open_osmid = osmid;

		// append OSM Tags(仮…テイクアウトなど判別した上で最終的には分ける)
		message += modal_osmbasic.make(tags);

		// append wikipedia
		if (tags.wikipedia !== undefined) {
			message += modal_wikipedia.element();
			winCont.modal_progress(100);
			modal_wikipedia.make(tags).then(html => {
				modal_wikipedia.set_dom(html);
				winCont.modal_progress(0);
			});
		};

		// append activity
		let actlists = poiCont.get_actlist(osmid);
		if (actlists.length > 0) message += modal_activities.make(actlists, openid);
		let catname = list_category.value !== "-" ? `&category=${list_category.value}` : "";
		history.replaceState('', '', location.pathname + "?" + osmid + (!openid ? "" : "." + openid) + catname + location.hash);
		winCont.modal_open({ "title": title, "message": message, "append": Conf.detail_view.buttons, "mode": "close", "callback_close": detail_close, "menu": true });
		if (openid !== undefined && actlists.length > 0) document.getElementById("modal_" + openid).scrollIntoView();

		$('[data-toggle="popover"]').popover();			// set PopUp
		cMapmaker.detail = true;
	}

	url_share() {			// URL共有機能
		function execCopy(string) {
			let pre = document.createElement('pre');			// ClipBord Copy
			pre.style.webkitUserSelect = 'auto';
			pre.style.userSelect = 'auto';
			let text = document.createElement("div");
			text.appendChild(pre).textContent = string;
			text.style.position = 'fixed';
			text.style.right = '200%';
			document.body.appendChild(text);
			document.getSelection().selectAllChildren(text);
			let copy = document.execCommand("copy");
			document.body.removeChild(text);
			return copy;
		};
		execCopy(location.href);
	}

	playback(flist) {					// 指定したリストを連続再生()
		const view_control = (list, idx) => {
			if (list.length >= (idx + 1)) {
				listTable.select(list[idx][0]);
				poiMarker.select(list[idx][0], false);
				if (this.status == "playback") {
					setTimeout(view_control, speed_calc(), list, idx + 1);
				};
			} else {
				listTable.disabled(false);
				listTable.heightSet(listTable.height + "px");	// mode end
				this.status = "normal";							// mode stop
				icon_change("play");
			};
		};
		const icon_change = (mode) => { list_playback.className = 'fas fa-' + mode };
		const speed_calc = () => { return ((parseInt(list_speed.value) / 100) * Conf.listTable.playback.timer) + 100 };
		if (this.status !== "playback") {
			listTable.disabled(true);
			listTable.heightSet(listTable.height / 4 + "px");
			leaflet.zoomSet(Conf.listTable.playback.zoomLevel);
			cMapmaker.mode_change("list");
			this.status = "playback";
			icon_change("stop");
			setTimeout(view_control, speed_calc(), flist, 0);
		} else {
			listTable.disabled(false);
			listTable.heightSet(listTable.height + "px");		// mode end
			this.status = "normal";								// mode stop
			icon_change("play");
		}
	}

	download() {
		const linkid = "temp_download";
		let csv = "", link;
		Conf.listTable.targets.forEach(target => { csv += basic.makeArray2CSV(poiCont.list(target)) });
		let bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
		let blob = new Blob([ bom, csv ], { 'type' : 'text/csv' });

		link = document.getElementById(linkid) ? document.getElementById(linkid) : document.createElement("a");
		link.id = linkid;
		link.href= URL.createObjectURL(blob);
		link.download = "my_data.csv";
		link.dataset.downloadurl = ['text/plain', link.download, link.href].join(':');
		document.body.appendChild(link);
		link.click();
	}
};

class cMapEvents {

	constructor() {
		this.busy = false;
		this.id = 0;
		this.timeout;
	}

	init() {
		map.on('moveend', () => cmap_events.map_move());   						// マップ移動時の処理
		map.on('zoomend', () => cmap_events.map_zoom());						// ズーム終了時に表示更新
		list_keyword.addEventListener('change', cmap_events.keyword_change);
		list_category.addEventListener('change', cmap_events.category_change);	// category change
	}

	map_move() {                							// map.moveend発生時のイベント
		return new Promise((resolve, reject) => {
			this.#map_move_promise(resolve, reject);
		});
	};

	#map_move_promise(resolve, reject) {
		console.log("cmapmaker: move event start.");
		if (this.busy > 1) { reject(); return; };		// 処理中の時は戻る
		if (this.busy == 1) clearTimeout(this.id);		// no break and cancel old timer.
		this.busy = 1;
		this.id = setTimeout(() => {
			console.log("cmapmaker: move event end.");
			this.busy = 2;
			cMapmaker.poi_get().then((status) => {
				this.busy = 0;
				listTable.list = [];
				let targets = (Conf.listTable.targets.indexOf("targets") > -1) ? [list_category.value] : ["-"];
				cMapmaker.poi_view(targets);	// in targets
				if (Conf.listTable.update_mode == "static" || status.update) {
					for (const target of Conf.listTable.targets) {
						switch (target) {
							case "activity":
								listTable.list = listTable.list.concat(listTable.list, poiCont.list("activity"));
								break;
							case "targets":
							default:
								listTable.list = listTable.list.concat(listTable.list, poiCont.list(Conf.targets));
								break;
						};
					}
					listTable.make();					// view all list
					listTable.make_category(Conf.listTable.targets);
					resolve();
				} else {
					cmap_events.#map_move_promise(resolve, reject);	// 失敗時はリトライ(接続先はoverpass.jsで変更)
				};
			}).catch(() => {
				this.busy = 0;
				console.log("mapmove:reject");
				reject();
			});
		}, 700);
	}

	map_zoom() {				// View Zoom Level & Status Comment
		let nowzoom = map.getZoom();
		let message = `${glot.get("zoomlevel")}${map.getZoom()} `;
		if (nowzoom < Conf.default.iconViewZoom) message += `<br>${glot.get("morezoom")}`;
		$("#zoomlevel").html("<h2 class='zoom'>" + message + "</h2>");
	};

	keyword_change() {        				// キーワード検索
		if (cmap_events.timeout > 0) {
			window.clearTimeout(cmap_events.timeout);
			cmap_events.timeout = 0;
		};
		cmap_events.timeout = window.setTimeout(() => {
			listTable.filter_keyword();
			cMapmaker.mode_change('list');
		}, 500);
	};

	category_change() {			// change category
		listTable.filter_category();
		let targets = (Conf.listTable.targets.indexOf("targets") > -1) ? [list_category.value] : ["-"];
		cMapmaker.poi_view(targets);	// in targets
		let catname = list_category.value !== "-" ? `?category=${list_category.value}` : "";
		history.replaceState('', '', location.pathname + catname + location.hash);
		list_category.blur();
		mapid.focus();
	};
}
var cmap_events = new cMapEvents();
