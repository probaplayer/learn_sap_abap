*&---------------------------------------------------------------------*
*& Include          ZCO_INVENTORY_COSTS_ANHBHN_TOP
*&---------------------------------------------------------------------*

TABLES: mara, marc, mard, makt, t001k, tka02, mbew, keko, keph.

* materail key information
TYPES: BEGIN OF st_material,
         matnr TYPE mara-matnr,
         mtart TYPE mara-mtart,
         werks TYPE mard-werks,
         lgort TYPE mard-lgort,
         labst TYPE mard-labst,
         meins TYPE mara-meins,
         maktx TYPE makt-maktx,
       END OF st_material.

* Sales Order Stock
TYPES: BEGIN OF st_sostock,
         matnr TYPE mara-matnr,
         mtart TYPE mara-mtart,
         meins TYPE mara-meins,
         werks TYPE mska-werks,
         lgort TYPE mska-lgort,
         sobkz TYPE mska-sobkz,
         kalab TYPE mska-kalab,
         maktx TYPE makt-maktx,
       END OF st_sostock.


* Get Controlling area
TYPES: BEGIN OF st_ctr_area,
          bwkey TYPE t001k-bwkey,
          bukrs TYPE t001k-bukrs,
          kokrs TYPE tka02-kokrs,
        END OF st_ctr_area.

* Get material valuation
TYPES: BEGIN OF st_material_valuations,
         matnr TYPE mbew-matnr,
         bwkey TYPE mbew-bwkey,
         kalkl TYPE mbew-kalkl,
         kaln1 TYPE mbew-kaln1,
         bwva2 TYPE mbew-bwva2,
         vers2 TYPE mbew-vers2,
         stprs TYPE mbew-stprs,
         peinh TYPE mbew-peinh,
         salk3 TYPE mbew-salk3,
         lbkum TYPE mbew-lbkum,
       END OF st_material_valuations.

TYPES: BEGIN OF st_product_costing,
         kalnr TYPE keko-kalnr,
         kadky TYPE keko-kadky,
         bwvar TYPE keko-bwvar,
         tvers TYPE keko-tvers,
         losgr TYPE keko-losgr,
       END OF st_product_costing.


TYPES: BEGIN OF st_cost_component,
         kalnr  TYPE keph-kalnr,
         kadky  TYPE keph-kadky,
         bwvar  TYPE keph-bwvar,
         tvers  TYPE keph-tvers,
         kst001 TYPE keph-kst001,
         kst002 TYPE keph-kst002,
         kst003 TYPE keph-kst003,
         kst004 TYPE keph-kst004,
         kst005 TYPE keph-kst005,
         kst006 TYPE keph-kst006,
         kst007 TYPE keph-kst007,
         kst008 TYPE keph-kst008,
         kst009 TYPE keph-kst009,
       END OF st_cost_component.

TYPES: BEGIN OF st_output,
         ersda        TYPE sy-datum,
         matnr        TYPE mara-matnr,
         bukrs        TYPE t001k-bukrs,
         werks        TYPE mard-werks,
         lgort        TYPE mard-lgort,
         sobkz        TYPE mska-sobkz,
         zmtart_output TYPE mara-mtart,
         mtart        TYPE mara-mtart,
         maktx        TYPE makt-maktx,
         labst        TYPE mard-labst,
         meins        TYPE mara-meins,
         sap_value    TYPE mbew-salk3,
         std_value    TYPE mbew-salk3,
         mat_cost     TYPE keph-kst001,
         frght_duty   TYPE keph-kst001,
         labor_var    TYPE keph-kst001,
         labor_fix    TYPE keph-kst001,
         ext_subcon   TYPE keph-kst001,
         ovrhead_var  TYPE keph-kst001,
         ovrhead_fix  TYPE keph-kst001,
         serv_cost    TYPE keph-kst001,
         spec_act     TYPE keph-kst001,
       END OF st_output.

DATA: lt_material_info TYPE TABLE OF st_material,
      lt_sale_orders TYPE TABLE OF st_sostock,
      lt_ctrl_area TYPE TABLE OF st_ctr_area,
      lt_material_valuations TYPE TABLE OF st_material_valuations,
      lt_product_costing TYPE TABLE OF st_product_costing,
      lt_cost_component TYPE TABLE OF st_cost_component,
      lt_output TYPE TABLE OF st_output.

      .