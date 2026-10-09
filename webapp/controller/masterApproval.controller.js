sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/mvc/XMLView"
], (Controller,XMLView) => {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.masterApproval", {

    onInit() {

            var oNavContainer = this.byId("mainNavContainer");

            this._oHomeDashboardView = sap.ui.xmlview({
                viewName: "vpamasterapproval.view.HomeDashboard"
            });

            oNavContainer.addPage(this._oHomeDashboardView);
            oNavContainer.to(this._oHomeDashboardView);
        },

    onNavigationSelect: function (oEvent) {

     console.log('event',oEvent);   


    var oItem = oEvent.getParameter("item");

    console.log('items',oItem)

    var sKey = oItem.getKey();

    console.log('key value',sKey)


    if(sKey==="model"){

             var oNavContainer = this.byId("mainNavContainer");

    if (!this._oModelMasterView) {
        this._oModelMasterView = sap.ui.xmlview({
            viewName: "vpamasterapproval.view.ModelMaster"
        });

        oNavContainer.addPage(this._oModelMasterView);
    }

    oNavContainer.to(this._oModelMasterView);

    }

    if(sKey==="pricing"){

        var oNavContainer=this.byId("mainNavContainer");

        if(!this._oModelPricingView){
            this._oModelPricingView= sap.ui.xmlview({
                viewName:"vpamasterapproval.view.PricingComponents"
            });

        oNavContainer.addPage(this._oModelPricingView);
        }
        oNavContainer.to(this._oModelPricingView)

    }


    if(sKey==="region"){


        var oNavContainer=this.byId("mainNavContainer");

        if(!this._oModelRegionView){

            this._oModelRegionView=sap.ui.xmlview({

                viewName:"vpamasterapproval.view.Regions"
            });

        oNavContainer.addPage(this._oModelRegionView);
        }

        oNavContainer.to(this._oModelRegionView);

    }

    if(sKey==="rto"){

        var oNavContainer=this.byId("mainNavContainer");

        if(!this._oModelRtoView){

            this._oModelRtoView=sap.ui.xmlview({
                viewName:"vpamasterapproval.view.RTOMasters"
            });

         oNavContainer.addPage(this._oModelRtoView);
        }
        
        oNavContainer.to(this._oModelRtoView);
    }


    if(sKey==="rtoexpense"){


        var oNavContainer=this.byId("mainNavContainer")


        if(!this._oModelRtoexpenseView){

            this._oModelRtoexpenseView=sap.ui.xmlview({
                viewName:"vpamasterapproval.view.RTOExpense"
            });


         oNavContainer.addPage(this._oModelRtoexpenseView);
        }

        oNavContainer.to(this._oModelRtoexpenseView)
    }


    if(sKey==="mto"){

        var oNavContainer=this.byId("mainNavContainer");


        if(!this._oModelMtoView){
            this._oModelMtoView=sap.ui.xmlview({

                viewName:"vpamasterapproval.view.MTOConfigurations"
            });
        
        oNavContainer.addPage(this._oModelMtoView);
        }

        oNavContainer.to(this._oModelMtoView);
    }


    if(sKey==="parts"){

        var oNavContainer=this.byId("mainNavContainer");


        if(!this._oModelPartsView){

            this._oModelPartsView=sap.ui.xmlview({
                viewName:"vpamasterapproval.view.Parts"
            })

          oNavContainer.addPage(this._oModelPartsView);
        }

        oNavContainer.to(this._oModelPartsView)
    }


}
    });
});