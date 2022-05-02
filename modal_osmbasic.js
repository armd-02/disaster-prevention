class modal_OSMbasic {
    // make modal html for OSM basic tags

    make(tags) {
        let catname = poiCont.get_catname(tags);
        let elements = 0;
        let html = `<div class="d-flex justify-content-between flex-wrap mb-3">`;

        // write type
        if (catname[0] !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-square"></i> ${catname[0]}${catname[1] !== "" ? "(" + catname[1] + ")" : ""}</div>`;
            elements++;
        };

        // write website
        if (tags.website !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-globe"></i> <a href="${tags.website}" target="_blank">${tags.website}</a></div>`;
            elements++;
        };

        // write tel
        if (tags.phone !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-phone-alt"></i> ${tags.phone}</div>`;
            elements++;
        };
        
        return elements > 0 ? html + "</div>" : "";
    };
}
var modal_osmbasic = new modal_OSMbasic();
