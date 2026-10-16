sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.HomeDashboard", {

        onInit: function () {
            console.log("Home Dashboard initialized");

            var oDate = new Date();

            var sFormattedDate = oDate.toLocaleDateString("en-IN", {

                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"

            })

            console.log("formatteddate", sFormattedDate)

            this.byId("date").setText(sFormattedDate);

            var sImageUrl = sap.ui.require.toUrl(
                "vpamasterapproval/images/rf.png"
            );

            console.log("IMAGE URL:", sImageUrl);
            console.log("IMAGE ABSOLUTE URL:", new URL(sImageUrl, document.baseURI).href);

            this.byId("bannerCarImage").setSrc(sImageUrl);

        },


        _loadModelCount: async function () {

            // model for reading

            var oModel = this.getView().getModel();

            var oDashboardData = {
                Models: { count: 0 },
                Regions: { count: 0 },
                PricingComponents: { count: 0 },
                RTOMasters: { count: 0 },
                RTOExpense: { count: 0 },
                Parts: { count: 0 },
                MTOConfigurations: { count: 0 }
            };



            var iPageSize = 100;

            var oBindingModel = oModel.bindList("/Models");

            var oReadModel = await oBindingModel.requestContexts(0, iPageSize);

            var countModel = oReadModel.length;

            oDashboardData.Models.count = countModel;

            console.log('model', countModel);

            oBindingModel.destroy();

            // region for reading

            var oBindingRegions = oModel.bindList("/Regions")

            var oReadRegions = await oBindingRegions.requestContexts(0, iPageSize);

            var countRegions = oReadRegions.length;



            oDashboardData.Regions.count = countRegions;

            console.log("region", countRegions)

            oBindingRegions.destroy();


            // pricing components for reading

            var oBindingPricingComponents = oModel.bindList("/PricingComponents");

            var oReadPricingComponents = await oBindingPricingComponents.requestContexts(0, iPageSize);

            var countPricingComponents = oReadPricingComponents.length;

            oDashboardData.PricingComponents.count = countPricingComponents;


            console.log("pricingcomponents", countPricingComponents)

            oBindingPricingComponents.destroy();

            // RTOMasters for reading


            var oBindingRTOMasters = oModel.bindList("/RTOMasters");

            var oReadRTOMasters = await oBindingRTOMasters.requestContexts(0, iPageSize);

            var countRTOMasters = oReadRTOMasters.length;

            oDashboardData.RTOMasters.count = countRTOMasters;


            console.log("rtomaster", countRTOMasters)

            oBindingRTOMasters.destroy();


            // RTOExpense for reading


            var oBindingRTOExpense = oModel.bindList("/RTOExpense");

            var oReadRTOExpense = await oBindingRTOExpense.requestContexts(0, iPageSize);

            var countRTOExpense = oReadRTOExpense.length;

            oDashboardData.RTOExpense.count = countRTOExpense;


            console.log("rtoexpense", countRTOExpense)

            oBindingRTOExpense.destroy();


            //Parts for reading

            var oBindingParts = oModel.bindList("/Parts");

            var oReadParts = await oBindingParts.requestContexts(0, iPageSize);

            var countParts = oReadParts.length;

            oDashboardData.Parts.count = countParts;


            console.log("parts", countParts)

            oBindingParts.destroy();

            //MTOConfigurations for reading

            var oBindingMTOConfigurations = oModel.bindList("/MTOConfigurations");

            var oReadMTOConfigurations = await oBindingMTOConfigurations.requestContexts(0, iPageSize);

            var countMTOConfigurations = oReadMTOConfigurations.length;

            oDashboardData.MTOConfigurations.count = countMTOConfigurations;


            console.log("mtoconfigurations", countMTOConfigurations)

            oBindingMTOConfigurations.destroy();


            var oDashboardModel = new sap.ui.model.json.JSONModel(oDashboardData);

            this.getView().setModel(oDashboardModel, "dashboardCounts");

            console.log("Dashboard counts:", oDashboardData);

        },



        _loadApprovalStatus: async function () {
            var oView = this.getView();
            var oModel = oView.getModel();

            if (!oModel) {
                console.error("OData V4 model is not available.");
                return;
            }

            var aEntities = [
                { name: "Regions", statusField: "status" },
                { name: "Models", statusField: "approvalStatus" },
                { name: "PricingComponents", statusField: "approvalStatus" },
                { name: "RTOMasters", statusField: "approvalStatus" },
                { name: "RTOExpense", statusField: "approvalStatus" },
                { name: "Parts", statusField: "approvalStatus" },
                { name: "MTOConfigurations", statusField: "approvalStatus" }
            ];

            var oCounts = {
                SUBMITTED: 0,
                APPROVED: 0,
                REJECTED: 0
            };

            var iTotalRecords = 0;
            var iMissingStatus = 0;

            // Read all configured entities in parallel.
            var aEntityResults = await Promise.allSettled(
                aEntities.map(async function (oEntity) {
                    var oEntityCounts = {
                        SUBMITTED: 0,
                        APPROVED: 0,
                        REJECTED: 0
                    };

                    var iEntityRecords = 0;
                    var iEntityMissingStatus = 0;
                    var oBinding;

                    try {
                        oBinding = oModel.bindList("/" + oEntity.name, null, null, null, { $select: oEntity.statusField });

                        var iStart = 0;
                        var iPageSize = 500;

                        while (true) {
                            var aContexts = await oBinding.requestContexts(iStart, iPageSize);

                            if (aContexts.length === 0) {
                                break;
                            }

                            iEntityRecords += aContexts.length;

                            aContexts.forEach(function (oContext) {
                                var oRecord = oContext.getObject();
                                var vStatus = oRecord[oEntity.statusField];

                                if (vStatus === null || vStatus === undefined || String(vStatus).trim() === "") {
                                    iEntityMissingStatus++;
                                    return;
                                }

                                var sStatus = String(vStatus).trim().toUpperCase();

                                if (Object.prototype.hasOwnProperty.call(oEntityCounts, sStatus)) {
                                    oEntityCounts[sStatus]++;
                                } else {
                                    console.debug("Status not included in chart:", oEntity.name, sStatus);
                                }
                            });

                            iStart += aContexts.length;

                            if (aContexts.length < iPageSize) {
                                break;
                            }
                        }

                        return {
                            name: oEntity.name,
                            counts: oEntityCounts,
                            records: iEntityRecords,
                            missingStatus: iEntityMissingStatus,
                            success: true
                        };

                    }
                    finally {
                        if (oBinding) {
                            oBinding.destroy();
                        }
                    }
                })
            );

            // Combine counts from every successfully loaded entity.
            aEntityResults.forEach(function (oResult, iIndex) {
                if (oResult.status !== "fulfilled") {
                    console.error("Failed to load entity:", aEntities[iIndex].name, oResult.reason);
                    return;
                }

                var oEntityResult = oResult.value;

                iTotalRecords += oEntityResult.records;
                iMissingStatus += oEntityResult.missingStatus;

                Object.keys(oCounts).forEach(function (sStatus) {
                    oCounts[sStatus] += oEntityResult.counts[sStatus];
                });

                console.log("Entity:", oEntityResult.name, "Records:", oEntityResult.records, "Counts:", oEntityResult.counts, "Missing statuses:", oEntityResult.missingStatus);
            });

            var iTotal = oCounts.SUBMITTED + oCounts.APPROVED + oCounts.REJECTED;

            console.log('total', iTotal)
            var oChartModel = new sap.ui.model.json.JSONModel({

                total: iTotal,
                items: [
                    {
                        status: "Submitted",
                        count: oCounts.SUBMITTED
                    },
                    {
                        status: "Approved",
                        count: oCounts.APPROVED
                    },
                    {
                        status: "Rejected",
                        count: oCounts.REJECTED
                    }
                ]
            });

            oView.setModel(oChartModel, "approvalStatus");

            console.log("Total records retrieved:", iTotalRecords);
            console.log("Records with missing statuses:", iMissingStatus);
            console.log("Final approval counts:", oCounts);
            console.log("Final chart data:", oChartModel.getData());




        },





        _loadVehiclePriceChart: async function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();

            var oPriceChartModel = new sap.ui.model.json.JSONModel({
                items: []
            });

            oView.setModel(oPriceChartModel, "priceModel");

            try {
                var oListBinding = oModel.bindList("/Models", undefined, undefined, undefined, { $select: "modelCode,modelDescription,gemValue" });

                var aContexts = await oListBinding.requestContexts(0, 100);

                var aItems = aContexts.map(function (oContext) {
                    var oData = oContext.getObject();

                    return {
                        modelCode: oData.modelCode,
                        modelDescription: oData.modelDescription,
                        gemValue: Number(oData.gemValue) || 0
                    };
                }).filter(function (oItem) {
                    return oItem.gemValue > 0;
                });

                oPriceChartModel.setProperty("/items", aItems);

                console.log("Vehicle chart records:", aItems);

                if (aItems.length === 0) {
                    console.warn("No Models records with a positive gemValue were found.");
                }

                oListBinding.destroy();

            } catch (oError) {
                console.error("Vehicle chart loading failed:", oError);
            }
        }

    });
});