sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("vpamasterapproval.controller.RTOMaster", {

        onInit: function () {
            // sap.ui.table has no "updateFinished" event; listen on the binding instead.
            // The binding is created after the view is rendered, so attach once the table has it.
            this.byId("rtoTable").attachEventOnce("rowsUpdated", this._attachCountListener, this);
        },

        _attachCountListener: function () {
            var oBinding = this.byId("rtoTable").getBinding("rows");
            oBinding.attachEvent("dataReceived", this._updateTitle, this);
            oBinding.attachEvent("change", this._updateTitle, this);
            this._updateTitle();
        },

        _updateTitle: function () {
            var oBinding = this.byId("rtoTable").getBinding("rows");
            var iCount = oBinding ? oBinding.getLength() : 0;   // needs $count: true
            this.byId("titleText").setText("RTO Master (" + iCount + " pending approval)");
        },

        /* ---------- formatter: 0.0800 -> 8 ---------- */
        formatPercent: function (v) {
            return v === null || v === undefined ? "" : String(parseFloat((parseFloat(v) * 100).toFixed(2)));
        },

        /* ---------- search + refresh ---------- */
        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var oBinding = this.byId("rtoTable").getBinding("rows");
            var aApp = sQuery
                ? [new Filter("region_regionCode", FilterOperator.Contains, sQuery)]
                : [];
            // "Application" filters are AND-ed with the static SUBMITTED filter from the view
            oBinding.filter(aApp, "Application");
        },

        onRefresh: function () {
            this.byId("rtoTable").getBinding("rows").refresh();
        },

        /* ---------- approve / reject ---------- */
        onApprove: function (oEvent) {
            this._confirmAndSet(oEvent, "APPROVED", "Approve this RTO record?");
        },

        onReject: function (oEvent) {
            this._confirmAndSet(oEvent, "REJECTED", "Reject this RTO record?");
        },

        _confirmAndSet: function (oEvent, sStatus, sText) {
            // In a grid table the button sits inside the row template, so its context is that row's V4 context
            var oCtx = oEvent.getSource().getBindingContext();
            var that = this;

            MessageBox.confirm(sText, {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) { return; }

                    oCtx.setProperty("approvalStatus", sStatus);   // -> PATCH /RTOMasters(<id>)

                    that.getView().getModel().submitBatch("$auto").then(function () {
                        MessageToast.show("Record " + sStatus.toLowerCase());
                        that.byId("rtoTable").getBinding("rows").refresh();   // row drops out of the list
                    }).catch(function (oErr) {
                        MessageBox.error(oErr.message);
                    });
                }
            });
        },

        /* ---------- export (loaded rows -> CSV) ---------- */
        onExport: function () {
            var oBinding = this.byId("rtoTable").getBinding("rows");
            var aCols = ["region_regionCode", "engineType", "ccMin", "ccMax",
                         "minimumPrice", "maximumPrice", "rtoPercent", "flatPriceValue", "validFrom"];

            oBinding.requestContexts(0, oBinding.getLength()).then(function (aCtx) {
                var aRows = [aCols.join(",")].concat(aCtx.map(function (c) {
                    return aCols.map(function (k) { return c.getProperty(k); }).join(",");
                }));
                var a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([aRows.join("\n")], { type: "text/csv" }));
                a.download = "RTOMaster_submitted.csv";
                a.click();
            });
        }
    });
});