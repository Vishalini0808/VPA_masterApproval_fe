sap.ui.define(["sap/ui/core/mvc/Controller"],function(Controller){
    "use strict";

   return Controller.extend("vpamasterapproval.controller.ModelMaster",{

    onInit: function(){
        console.log("Model master controller initialized");

        var oTable=this.byId("model");

        var oTemplate=this.byId("modelMasterRow");

        console.log(oTable);

        console.log(oTemplate);
        
        oTable.bindItems({
            path:"/Models",
            template:oTemplate
        })
    },

    onSearch:function(){

        var sValue = oEvent.getParameter("query");
         console.log("Search value:", sValue);

    },


       onRefresh: function () {
            console.log("Refresh clicked");
        },

        onImport: function () {
            console.log("Import clicked");
        },

        onItemsPerPageChange: function (oEvent) {
            var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            console.log("Items per page:", sSelectedKey);
        },

        onPreviousPage: function () {
            console.log("Previous page clicked");
        },

        onNextPage: function () {
            console.log("Next page clicked");
        },

        onPagePress: function (oEvent) {
            var sPage = oEvent.getSource().getText();
            console.log("Page clicked:", sPage);
        }

   })
})