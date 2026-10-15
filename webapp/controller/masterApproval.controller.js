sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/mvc/XMLView",
    "sap/ui/core/BusyIndicator"
], (Controller, XMLView, BusyIndicator) => {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.masterApproval", {

        
onInit: async function () {

    var oComponent = this.getOwnerComponent();
    var oModel = oComponent.getModel();

    var oNavContainer = this.byId("mainNavContainer");

    // Show busy indicator immediately
    oNavContainer.setBusyIndicatorDelay(0);
    oNavContainer.setBusy(true);

    try {

        this._oHomeDashboardView = sap.ui.xmlview({
            viewName: "vpamasterapproval.view.HomeDashboard"
        });

        this._oHomeDashboardView.setModel(oModel);

        oNavContainer.addPage(this._oHomeDashboardView);
        oNavContainer.to(this._oHomeDashboardView);

        var oHomeController =
            this._oHomeDashboardView.getController();

        // Wait until all dashboard data is loaded
        await Promise.all([

            oHomeController._loadApprovalStatus(),

            oHomeController._loadVehiclePriceChart(),

            oHomeController._loadModelCount()

        ]);

    } catch (oError) {

        console.error("Home Dashboard loading failed:", oError);

    } finally {

        // Hide busy indicator after loading
        oNavContainer.setBusy(false);

    }
},





        
onNavigationSelect: async function (oEvent) {

    var sKey = oEvent.getParameter("item").getKey();

    var oNavContainer = this.byId("mainNavContainer");

    oNavContainer.setBusyIndicatorDelay(0);
    oNavContainer.setBusy(true);

    try {

        // Home Dashboard
        if (sKey === "home") {

            oNavContainer.to(this._oHomeDashboardView);

            var oHomeController =
                this._oHomeDashboardView.getController();

            await Promise.all([
                oHomeController._loadModelCount(),
                oHomeController._loadApprovalStatus(),
                oHomeController._loadVehiclePriceChart()
            ]);

            return;
        }

        // Master View Configuration
        var mViews = {

            model: {
                name: "ModelMaster",
                property: "_oModelMasterView"
            },

            pricing: {
                name: "PricingComponents",
                property: "_oModelPricingView"
            },

            region: {
                name: "Regions",
                property: "_oModelRegionView"
            },

            rto: {
                name: "RTOMasters",
                property: "_oModelRtoView"
            },

            rtoexpense: {
                name: "RTOExpense",
                property: "_oModelRtoexpenseView"
            },

            mto: {
                name: "MTOConfigurations",
                property: "_oModelMtoView"
            },

            parts: {
                name: "Parts",
                property: "_oModelPartsView"
            }

        };

        var oConfig = mViews[sKey];

        if (!oConfig) {
            return;
        }

        var oTargetView = this[oConfig.property];

        // Create view only once
        if (!oTargetView) {

            oTargetView = await XMLView.create({

                viewName:
                    "vpamasterapproval.view." + oConfig.name

            });

            oTargetView.setModel(
                this.getOwnerComponent().getModel()
            );

            oNavContainer.addPage(oTargetView);

            this[oConfig.property] = oTargetView;
        }

        // Navigate
        oNavContainer.to(oTargetView);

        // Wait for target view data loading
        var oController = oTargetView.getController();

        if (typeof oController.loadData === "function") {

            await oController.loadData();

        }

    } catch (oError) {

        console.error("Navigation failed:", oError);

    } finally {

        oNavContainer.setBusy(false);

    }

}



    });
});