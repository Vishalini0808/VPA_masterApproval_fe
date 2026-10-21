sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.MTOConfigurations", {

        onInit: function () {
            this._aConfigs = [];   // raw configurations (with parts) read from the service
            this._sQuery = "";

            // JSON model that holds the tree: MTO configuration -> parts
            this.getView().setModel(new JSONModel({ count: 0, selectedCount: 0, nodes: [] }), "tree");
        },



        onSelectionChange: function () {

            var oTable = this.byId("mtoTreeTable");

            oTable.getSelectedIndices().forEach(function (iIndex) {

                var oContext = oTable.getContextByIndex(iIndex);

                if (!oContext || oContext.getProperty("type") !== "config") {
                    oTable.removeSelectionInterval(iIndex, iIndex);
                }

            });

            this.getView()
                .getModel("tree")
                .setProperty(
                    "/selectedCount",
                    oTable.getSelectedIndices().length
                );

        },


        _clearSelection: function () {

            this.byId("mtoTreeTable").clearSelection();

            this.getView()
                .getModel("tree")
                .setProperty("/selectedCount", 0);

        },

        /* ---------- data loading (called by masterApproval controller on navigation) ---------- */

        loadData: async function () {
            var oView = this.getView();
            var oModel = oView.getModel();

            if (!oModel) {
                return;
            }

            oView.setBusy(true);

            try {
                // only SUBMITTED configurations, each with its parts and part details
                var oListBinding = oModel.bindList(
                    "/MTOConfigurations",
                    null,
                    [],
                    [new Filter("approvalStatus", FilterOperator.EQ, "SUBMITTED")],
                    {
                        $expand: {
                            parts: {
                                $expand: { part: { $select: ["partCode", "description"] } }
                            }
                        }
                    }
                );

                var aContexts = await oListBinding.requestContexts(0, 1000);
                this._aConfigs = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });
                oListBinding.destroy();

                this._buildTree();
            } catch (oError) {
                MessageToast.show("Loading failed: " + oError.message);
            } finally {
                oView.setBusy(false);
            }
        },

        /* ---------- build / filter the tree ---------- */

        _buildTree: function () {
            this._clearSelection();
            var sQuery = (this._sQuery || "").toLowerCase();
            var sKey = this.byId("mtoFieldFilterSelect").getSelectedKey();

            var aNodes = this._aConfigs.map(function (oConfig) {
                return {
                    type: "config",
                    name: oConfig.mtoModelCode,
                    mtoModelCode: oConfig.mtoModelCode,
                    referenceModel: oConfig.referenceMTSModel_modelCode || "",
                    validFrom: oConfig.validFrom || "",
                    status: oConfig.approvalStatus,
                    children: (oConfig.parts || []).map(function (oPart) {
                        var sCode = oPart.part_partCode || (oPart.part && oPart.part.partCode) || "";
                        return {
                            type: "part",
                            name: sCode,
                            description: (oPart.part && oPart.part.description) || "",
                            quantity: oPart.quantity
                        };
                    })
                };
            }).filter(function (oNode) {
                if (!sQuery) {
                    return true;
                }
                var aFields = sKey === "all" ? ["mtoModelCode", "referenceModel"] : [sKey];
                return aFields.some(function (sField) {
                    return String(oNode[sField] || "").toLowerCase().indexOf(sQuery) > -1;
                });
            });

            var oTreeModel = this.getView().getModel("tree");
            oTreeModel.setData({ count: aNodes.length, selectedCount: 0, nodes: aNodes });
        },

        /* ---------- search / refresh / expand ---------- */

        onSearch: function (oEvent) {
            this._sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            this._buildTree();
        },

        onFieldFilterChange: function () {
            this._buildTree();
        },

        onExpandAll: function () {
            this.byId("mtoTreeTable").expandToLevel(1);
        },

        onCollapseAll: function () {
            this.byId("mtoTreeTable").collapseAll();
        },

        onRefresh: async function () {
            this._sQuery = "";
            this.byId("mtoSearchField").setValue("");
            this.byId("mtoFieldFilterSelect").setSelectedKey("all");
            await this.loadData();
            MessageToast.show("Data refreshed");
        },

        /* ---------- status badge ---------- */

        formatStatusText: function (sStatus) {
            return sStatus ? sStatus.charAt(0).toUpperCase() + sStatus.slice(1).toLowerCase() : "";
        },

        formatStatusState: function (sStatus) {
            switch ((sStatus || "").toUpperCase()) {
                case "SUBMITTED": return "Warning";
                case "APPROVED": return "Success";
                case "REJECTED": return "Error";
                default: return "None";
            }
        },

        /* ---------- approve / reject (parent rows only) ---------- */


        onApproveSelected: function () {

            this._processSelectedMTO(
                "approveMaster",
                "approve"
            );

        },

        onRejectSelected: function () {

            this._processSelectedMTO(
                "rejectMaster",
                "reject"
            );

        },

        _processSelectedMTO: function (sAction, sOperation) {

            var oTable = this.byId("mtoTreeTable");
            var oModel = this.getView().getModel();

            var aIndices = oTable.getSelectedIndices();

            if (!aIndices.length) {

                MessageToast.show(
                    "Please select at least one MTO Configuration"
                );

                return;
            }

            // Only process parent configuration rows.
            // Selected child/part rows are ignored.

            var aRecords = aIndices.map(function (iIndex) {

                var oContext = oTable.getContextByIndex(iIndex);

                if (!oContext) {
                    return null;
                }

                if (oContext.getProperty("type") !== "config") {
                    return null;
                }

                return {
                    mtoModelCode: oContext.getProperty("mtoModelCode")
                };

            }).filter(function (oRecord) {
                return oRecord !== null;
            });

            if (!aRecords.length) {

                MessageBox.warning(
                    "Please select MTO Configuration parent rows. " +
                    "Part rows cannot be approved separately."
                );

                return;
            }

            if (aRecords.some(function (oRecord) {
                return !oRecord.mtoModelCode;
            })) {

                MessageBox.error(
                    "MTO Model Code is missing for a selected configuration."
                );

                return;
            }

            MessageBox.confirm(
                "Are you sure you want to " +
                sOperation + " " +
                aRecords.length + " selected MTO Configuration(s)?",
                {
                    title: sOperation === "approve"
                        ? "Confirm Approval"
                        : "Confirm Rejection",

                    actions: [
                        MessageBox.Action.YES,
                        MessageBox.Action.NO
                    ],

                    emphasizedAction: MessageBox.Action.YES,

                    onClose: async function (sResult) {

                        if (sResult !== MessageBox.Action.YES) {
                            return;
                        }

                        var iSuccess = 0;
                        var aFailed = [];

                        oTable.setBusy(true);

                        try {

                            for (const oRecord of aRecords) {

                                try {

                                    var oAction = oModel.bindContext(
                                        "/" + sAction + "(...)"
                                    );

                                    oAction.setParameter(
                                        "entityName",
                                        "MTOConfigurations"
                                    );

                                    oAction.setParameter(
                                        "recordKey",
                                        JSON.stringify({
                                            mtoModelCode: oRecord.mtoModelCode
                                        })
                                    );

                                    await oAction.execute("$direct");

                                    var oResult = oAction
                                        .getBoundContext()
                                        .getObject();

                                    if (oResult && oResult.value === false) {

                                        throw new Error(
                                            "Backend returned false"
                                        );

                                    }

                                    iSuccess++;

                                } catch (oError) {

                                    aFailed.push({
                                        mtoModelCode: oRecord.mtoModelCode,
                                        error: oError.message
                                    });

                                }

                            }

                            this._clearSelection();

                            if (aFailed.length === 0) {

                                MessageToast.show(
                                    iSuccess +
                                    " MTO Configuration(s) successfully " +
                                    (sOperation === "approve"
                                        ? "approved"
                                        : "rejected")
                                );

                            } else {

                                MessageBox.warning(
                                    iSuccess + " succeeded, " +
                                    aFailed.length + " failed.\n\n" +
                                    aFailed.map(function (oItem) {

                                        return oItem.mtoModelCode +
                                            ": " + oItem.error;

                                    }).join("\n")
                                );

                            }

                        } catch (oError) {

                            MessageBox.error(
                                oError.message || "Bulk operation failed"
                            );

                        } finally {

                            oTable.setBusy(false);

                            // Reload SUBMITTED configurations
                            await this.loadData();

                        }

                    }.bind(this)
                }
            );

        },

    });
});