sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.HomeDashboard", {

        onInit: function () {
            console.log("Home Dashboard initialized");

            var oDate=new Date();

            var sFormattedDate=oDate.toLocaleDateString("en-IN",{

             weekday: "long",
             day: "numeric",
             month: "long",
             year: "numeric"

            })

            console.log("formatteddate",sFormattedDate)

            this.byId("date").setText(sFormattedDate)


        }

    });
});