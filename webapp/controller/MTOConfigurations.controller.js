sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.MTOConfigurations", {

        onInit: function () {
            this._aConfigs = [];   // raw configurations (with parts) read from the service
            this._sQuery = "";

            // JSON model that holds the tree: MTO configuration -> parts
            this.getView().setModel(new JSONModel({ count: 0, nodes: [] }), "tree");
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
            oTreeModel.setData({ count: aNodes.length, nodes: aNodes });
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

        onApprove: function (oEvent) {
            this._setApprovalStatus(oEvent.getSource().getBindingContext("tree"), "APPROVED");
        },

        onReject: function (oEvent) {
            this._setApprovalStatus(oEvent.getSource().getBindingContext("tree"), "REJECTED");
        },

        _setApprovalStatus: async function (oTreeContext, sStatus) {
            var sCode = oTreeContext.getProperty("mtoModelCode");
            var oModel = this.getView().getModel();
            var sPath = "/MTOConfigurations('" + encodeURIComponent(sCode) + "')";
            var oBinding = oModel.bindContext(sPath);

            try {
                await oBinding.requestObject();
                await oBinding.getBoundContext().setProperty("approvalStatus", sStatus);
                MessageToast.show("Marked as " + this.formatStatusText(sStatus));
                // no longer SUBMITTED, so reload the list
                await this.loadData();
            } catch (oError) {
                MessageToast.show("Update failed: " + oError.message);
            } finally {
                oBinding.destroy();
            }
        }
    });
});