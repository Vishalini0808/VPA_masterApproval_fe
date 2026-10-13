
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox
) {
    "use strict";

    return Controller.extend(
        "vpamasterapproval.controller.PricingComponents", {

        onInit: function () {

            var oViewModel = new JSONModel({

                pendingCountText: "Loading pending records..."

            });

            this.getView().setModel(
                oViewModel,
                "pricingCompApprovalVM"
            );

        },

        onRowsUpdated: function () {

            this._loadPendingCount();

        },

        _loadPendingCount: function () {

            var oTable = this.byId(
                "pricingCompApprovalTable"
            );

            var oBinding = oTable.getBinding("rows");

            var oViewModel = this.getView()
                .getModel("pricingCompApprovalVM");

            if (!oBinding) {
                return;
            }

            var iCount = oBinding.getLength();

            oViewModel.setProperty(
                "/pendingCountText",
                iCount + " records pending for approval"
            );

        },

        onSearch: function () {

            var sQuery = this.byId(
                "pricingCompApprovalSearchField"
            ).getValue().trim();

            var sField = this.byId(
                "pricingCompApprovalFieldFilterSelect"
            ).getSelectedKey();

            var oTable = this.byId(
                "pricingCompApprovalTable"
            );

            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            // Always show SUBMITTED records only

            var aFilters = [

                new Filter(
                    "approvalStatus",
                    FilterOperator.EQ,
                    "SUBMITTED"
                )

            ];

            if (sQuery) {

                var aSearchFilters = [];

                if (sField === "all") {

                    aSearchFilters = [

                        new Filter(
                            "regionCode",
                            FilterOperator.Contains,
                            sQuery
                        ),

                        new Filter(
                            "engineType",
                            FilterOperator.Contains,
                            sQuery
                        )

                    ];

                } else {

                    aSearchFilters.push(

                        new Filter(
                            sField,
                            FilterOperator.Contains,
                            sQuery
                        )

                    );

                }

                // OR condition for search fields

                aFilters.push(

                    new Filter({
                        filters: aSearchFilters,
                        and: false
                    })

                );

            }

            // Apply SUBMITTED + Search filter

            oBinding.filter(aFilters);

        },

        onRefresh: function () {

            var oTable = this.byId(
                "pricingCompApprovalTable"
            );

            var oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            oBinding.refresh();

            MessageToast.show(
                "Pricing Components refreshed"
            );

        },

        onApprove: function (oEvent) {

            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Unable to identify selected Pricing Component.");
                return;
            }

            var sRegionCode = oContext.getProperty("regionCode");
            var sEngineType = oContext.getProperty("engineType");

            MessageBox.confirm(
                "Are you sure you want to approve pricing components for " +
                sRegionCode + " (" + sEngineType + ")?",
                {
                    title: "Confirm Approval",

                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],

                    emphasizedAction: MessageBox.Action.YES,

                    onClose: function (sAction) {

                        if (sAction === MessageBox.Action.YES) {

                            this._updateApprovalStatus(
                                oEvent,
                                "approveMaster",
                                "approve"
                            );

                        }

                    }.bind(this)
                }
            );

        },

        onReject: function (oEvent) {

            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Unable to identify selected Pricing Component.");
                return;
            }

            var sRegionCode = oContext.getProperty("regionCode");
            var sEngineType = oContext.getProperty("engineType");

            MessageBox.confirm(
                "Are you sure you want to reject pricing components for " +
                sRegionCode + " (" + sEngineType + ")?",
                {
                    title: "Confirm Rejection",

                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],

                    emphasizedAction: MessageBox.Action.NO,

                    onClose: function (sAction) {

                        if (sAction === MessageBox.Action.YES) {

                            this._updateApprovalStatus(
                                oEvent,
                                "rejectMaster",
                                "reject"
                            );

                        }

                    }.bind(this)
                }
            );

        },
        // ==========================================
        // COMMON APPROVE / REJECT BACKEND CALL
        // ==========================================

        _updateApprovalStatus: async function (
            oEvent,
            sAction,
            sOperation
        ) {

            var oButton = oEvent.getSource();

            var oContext = oButton.getBindingContext();

            if (!oContext) {
                MessageBox.error("Unable to identify selected Pricing Component.");
                return;
            }

            var sRegionCode = oContext.getProperty("regionCode");
            var sEngineType = oContext.getProperty("engineType");

            var oModel = oContext.getModel();

            var oTable = this.byId("pricingCompApprovalTable");

            try {

                oButton.setEnabled(false);

                // Bind common unbound CAP action
                var oAction = oModel.bindContext(
                    "/" + sAction + "(...)"
                );

                // Entity name
                oAction.setParameter(
                    "entityName",
                    "PricingComponents"
                );

                // Composite primary key
                oAction.setParameter(
                    "recordKey",
                    JSON.stringify({
                        regionCode: sRegionCode,
                        engineType: sEngineType
                    })
                );

                // Execute CAP action
                await oAction.execute();

                // Read action response
                var oResult = await oAction
                    .getBoundContext()
                    .requestObject();

                if (oResult && oResult.value === false) {
                    throw new Error(
                        "Unable to " + sOperation + " Pricing Components."
                    );
                }

                MessageToast.show(
                    "Pricing Components for " +
                    sRegionCode + " (" + sEngineType + ") " +
                    (sOperation === "approve"
                        ? "approved"
                        : "rejected") +
                    " successfully"
                );

                // Refresh table after successful action
                var oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    oBinding.refresh();
                }

            } catch (oError) {

                console.error(
                    "Pricing Components " + sOperation + " failed:",
                    oError
                );

                MessageBox.error(
                    oError.message ||
                    "Unable to " + sOperation + " Pricing Components."
                );

            } finally {

                oButton.setEnabled(true);

            }

        }

    });

});
