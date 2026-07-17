*&---------------------------------------------------------------------*
*& Include          ZCO_INVENTORY_COSTS_ANHBHN_F01
*&---------------------------------------------------------------------*

*Get material Key information -- 1.1.a.1
FORM get_material_key_information.
  SELECT mara~matnr,
        mara~mtart,
        mard~werks,
        mard~lgort,
        mard~labst,
        mara~meins,
        makt~maktx
  INTO TABLE @lt_material_info
  FROM mara
    INNER JOIN marc
      ON mara~matnr = marc~matnr
    INNER JOIN mard
      ON mara~matnr = mard~matnr
      AND mard~werks = marc~werks
    INNER JOIN makt
      ON mara~matnr = makt~matnr
      AND makt~spras = @sy-langu
   WHERE mara~matnr IN @s_matnr
      AND mara~mtart IN @s_mtart
      AND mard~werks IN @s_plant
      AND mard~lgort IN @s_lgort
      AND mard~labst > 0
   .
ENDFORM.


*Get Sales Order Stock -- 1.1.a.2
FORM get_sales_orders.
  SELECT
    mara~matnr,
    mara~mtart,
    mara~meins,
    mska~werks,
    mska~lgort,
    mska~sobkz,
    mska~kalab,
    makt~maktx
  INTO TABLE @lt_sale_orders
  FROM mska
    INNER JOIN mara
      ON mska~matnr = mara~matnr
    INNER JOIN makt
      ON mara~matnr = makt~matnr
     AND makt~spras = @sy-langu
   WHERE mara~matnr IN @s_matnr
     AND mara~mtart IN @s_mtart
     AND mska~werks IN @s_plant
     AND mska~lgort IN @s_lgort
     AND mska~kalab > 0
    .
ENDFORM.

*Get controlling area -- In_1.1.b.1
FORM get_controlling_area.
  SELECT
    bwkey,
    t001k~bukrs,
    kokrs
  INTO TABLE @lt_ctrl_area
  FROM t001k
    INNER JOIN tka02
    ON t001k~bukrs = tka02~bukrs
  WHERE
    bwkey IN @s_plant
    .
ENDFORM.

* Retrieve Cost Estimate Number - Product Costing - In_1.1.b.2
FORM get_material_valuation.

  DATA: lt_matnr_all TYPE STANDARD TABLE OF mara-matnr WITH DEFAULT KEY.

  LOOP AT lt_material_info INTO DATA(ls_mat).
    APPEND ls_mat-matnr TO lt_matnr_all.
  ENDLOOP.

  LOOP AT lt_sale_orders INTO DATA(ls_so).
    APPEND ls_so-matnr TO lt_matnr_all.
  ENDLOOP.

  SORT lt_matnr_all.
  DELETE ADJACENT DUPLICATES FROM lt_matnr_all.

  IF lt_matnr_all IS NOT INITIAL.
    SELECT
        matnr,
        bwkey,
        kalkl,
        kaln1,
        bwva2,
        vers2,
        stprs,
        peinh,
        salk3,
        lbkum
      INTO TABLE @lt_material_valuations
      FROM mbew
      FOR ALL ENTRIES IN @lt_matnr_all
      WHERE matnr = @lt_matnr_all-table_line
      AND kalkl = 'X'
      .
  ENDIF.
ENDFORM.

*In_1.1.b.3
FORM get_product_costing.
  DATA: lr_kokrs TYPE RANGE OF tka02-kokrs,
        ls_kokrs LIKE LINE OF lr_kokrs.

  LOOP AT lt_ctrl_area INTO DATA(wa_ctrl_area).
    ls_kokrs-sign   = 'I'.
    ls_kokrs-option = 'EQ'.
    ls_kokrs-low    = wa_ctrl_area-kokrs.
    APPEND ls_kokrs TO lr_kokrs.
    CLEAR ls_kokrs.
  ENDLOOP.

  IF lt_material_valuations IS NOT INITIAL
      AND lr_kokrs             IS NOT INITIAL.

    SELECT
        kalnr,
        kadky,
        bwvar,
        tvers,
        losgr
      FROM keko
      INTO TABLE @lt_product_costing
      FOR ALL ENTRIES IN @lt_material_valuations
      WHERE
        matnr = @lt_material_valuations-matnr
        AND bwkey = @lt_material_valuations-bwkey
        AND kalnr = @lt_material_valuations-kaln1
        AND bwvar = @lt_material_valuations-bwva2
        AND tvers = @lt_material_valuations-vers2
        AND kokrs IN @lr_kokrs
        AND bzobj = '0'
        AND kalka = '01'
        AND freig = 'X'
        AND kadat <= @p_date
        AND bidat >= @p_date
      .

  ENDIF.
ENDFORM.


*In_1.1.b.4
FORM get_cost_component.
  IF lt_product_costing IS NOT INITIAL.
    SELECT
        kalnr, kadky, bwvar, tvers,
        kst001, kst002, kst003, kst004, kst005,
        kst006, kst007, kst008, kst009
      FROM keph
      INTO TABLE @lt_cost_component
      FOR ALL ENTRIES IN @lt_product_costing
      WHERE kalnr = @lt_product_costing-kalnr
        AND kadky = @lt_product_costing-kadky
        AND bwvar = @lt_product_costing-bwvar
        AND tvers = @lt_product_costing-tvers
        AND bzobj = '0'
        AND kalka = '01'
      .
  ENDIF.
ENDFORM.


FORM calculate_cost.

  CLEAR lt_output.

  LOOP AT lt_material_info INTO DATA(ls_mat).
    PERFORM build_line USING ls_mat-matnr ls_mat-werks ls_mat-lgort
                             ls_mat-mtart ls_mat-maktx ls_mat-meins
                             ls_mat-labst space.
  ENDLOOP.

  LOOP AT lt_sale_orders INTO DATA(ls_so).
    PERFORM build_line USING ls_so-matnr ls_so-werks ls_so-lgort
                             ls_so-mtart ls_so-maktx ls_so-meins
                             ls_so-kalab ls_so-sobkz.
  ENDLOOP.
ENDFORM.


FORM build_line USING iv_matnr TYPE mara-matnr
                      iv_werks TYPE mard-werks
                      iv_lgort TYPE mard-lgort
                      iv_mtart TYPE mara-mtart
                      iv_maktx TYPE makt-maktx
                      iv_meins TYPE mara-meins
                      iv_qty   TYPE mard-labst
                      iv_sobkz TYPE mska-sobkz.

  DATA: ls_out TYPE st_output.

  READ TABLE lt_material_valuations INTO DATA(ls_mbew)
       WITH KEY matnr = iv_matnr.
*  IF sy-subrc <> 0. RETURN. ENDIF.

  IF ls_mbew-peinh <> 0.
    ls_out-std_value = ls_mbew-stprs / ls_mbew-peinh * iv_qty.
  ENDIF.
  IF ls_mbew-lbkum <> 0.
    ls_out-sap_value = ls_mbew-salk3 / ls_mbew-lbkum * iv_qty.
  ENDIF.

  READ TABLE lt_product_costing INTO DATA(ls_keko)
       WITH KEY kalnr = ls_mbew-kaln1
                bwvar = ls_mbew-bwva2
                tvers = ls_mbew-vers2.

  IF sy-subrc = 0 AND ls_keko-losgr IS NOT INITIAL.
    READ TABLE lt_cost_component INTO DATA(ls_keph)
         WITH KEY kalnr = ls_keko-kalnr
                  kadky = ls_keko-kadky
                  bwvar = ls_keko-bwvar
                  tvers = ls_keko-tvers.

    IF sy-subrc = 0.
      ls_out-mat_cost    = ls_keph-kst001 / ls_keko-losgr * iv_qty.  " 10
      ls_out-frght_duty  = ls_keph-kst002 / ls_keko-losgr * iv_qty.  " 15
      ls_out-labor_var   = ls_keph-kst003 / ls_keko-losgr * iv_qty.  " 20
      ls_out-labor_fix   = ls_keph-kst004 / ls_keko-losgr * iv_qty.  " 30
      ls_out-ext_subcon  = ls_keph-kst005 / ls_keko-losgr * iv_qty.  " 35
      ls_out-ovrhead_var = ls_keph-kst006 / ls_keko-losgr * iv_qty.  " 40
      ls_out-ovrhead_fix = ls_keph-kst007 / ls_keko-losgr * iv_qty.  " 50
      ls_out-serv_cost   = ls_keph-kst008 / ls_keko-losgr * iv_qty.  " 60
      ls_out-spec_act    = ls_keph-kst009 / ls_keko-losgr * iv_qty.  " 70
    ENDIF.
  ENDIF.

  READ TABLE lt_ctrl_area INTO DATA(ls_ctrl_area)
       WITH KEY bwkey = iv_werks.
  IF sy-subrc = 0.
    ls_out-bukrs = ls_ctrl_area-bukrs.
  ENDIF.

  ls_out-ersda = p_date.
  ls_out-matnr = iv_matnr.
  ls_out-werks = iv_werks.
  ls_out-lgort = iv_lgort.
  ls_out-sobkz = iv_sobkz.
  ls_out-mtart = iv_mtart.
  ls_out-maktx = iv_maktx.
  ls_out-labst = iv_qty.
  ls_out-meins = iv_meins.


  IF    p_mafert IS NOT INITIAL AND iv_matnr IN p_mafert.
    ls_out-zmtart_output = 'FERT'.
  ELSEIF p_mahalb IS NOT INITIAL AND iv_matnr IN p_mahalb.
    ls_out-zmtart_output = 'HALB'.
  ELSEIF p_maroh  IS NOT INITIAL AND iv_matnr IN p_maroh.
    ls_out-zmtart_output = 'ROH'.
  ELSE.
    ls_out-zmtart_output = 'FERT'.
  ENDIF.

  APPEND ls_out TO lt_output.
ENDFORM.


FORM check_authorization.
  LOOP AT s_plant INTO DATA(ls_plant).
    AUTHORITY-CHECK OBJECT 'M_MATE_WRK'
             ID 'ACTVT' FIELD '03'
             ID 'WERKS' FIELD ls_plant-low.

    IF sy-subrc <> 0.
      MESSAGE e001(00) WITH 'No authorization to display plant' ls_plant-low.
    ENDIF.
  ENDLOOP.
ENDFORM.

FORM clean_table.
  CLEAR: lt_material_info,
          lt_sale_orders,
          lt_ctrl_area,
          lt_material_valuations,
          lt_product_costing,
          lt_cost_component,
          lt_output.
ENDFORM.

FORM display.
  PERFORM clean_table.
  PERFORM get_material_key_information.
  PERFORM get_sales_orders.
  PERFORM get_controlling_area.
  PERFORM get_material_valuation.
  PERFORM get_product_costing.
  PERFORM get_cost_component.
  PERFORM calculate_cost.
  PERFORM show_ouput.

ENDFORM.


FORM show_ouput.

  DEFINE zero_if_initial.
    &2 = COND #( WHEN &1 IS INITIAL THEN 0 ELSE &1 ).
  END-OF-DEFINITION.

  DATA: BEGIN OF ls_sum,
          bukrs          TYPE t001k-bukrs,
          werks          TYPE mard-werks,
          lgort          TYPE mard-lgort,
          zgroup         TYPE char20,
          material_cost  TYPE p LENGTH 15 DECIMALS 2,
          fd_mh          TYPE p LENGTH 15 DECIMALS 2,
          internal_labor TYPE p LENGTH 15 DECIMALS 2,
          external_labor TYPE p LENGTH 15 DECIMALS 2,
          total          TYPE p LENGTH 15 DECIMALS 2,
        END OF ls_sum.
  DATA: lt_sum LIKE TABLE OF ls_sum.

  DATA: lv_mat TYPE p LENGTH 15 DECIMALS 2,
        lv_fd  TYPE p LENGTH 15 DECIMALS 2,
        lv_int TYPE p LENGTH 15 DECIMALS 2,
        lv_ext TYPE p LENGTH 15 DECIMALS 2,
        lv_tot TYPE p LENGTH 15 DECIMALS 2.

  LOOP AT lt_output INTO DATA(ls_out).
    CLEAR ls_sum.

    IF ls_out-zmtart_output = 'FERT'
       OR ( ls_out-mtart = 'FERT' AND ls_out-zmtart_output IS INITIAL ).
      ls_sum-zgroup = 'FINISHED PRODUCTS'.
    ELSEIF ls_out-zmtart_output = 'HALB'
       OR ( ls_out-mtart = 'HALB' AND ls_out-zmtart_output IS INITIAL ).
      ls_sum-zgroup = 'COMPONENTS'.
    ELSEIF ls_out-zmtart_output = 'ROH'
       OR ( ls_out-mtart = 'ROH' AND ls_out-zmtart_output IS INITIAL ).
      ls_sum-zgroup = 'RAW MATERIALS'.
    ELSE.
      CONTINUE.
    ENDIF.

    ls_sum-bukrs          = ls_out-bukrs.
    ls_sum-werks          = ls_out-werks.
    ls_sum-lgort          = ls_out-lgort.
    ls_sum-material_cost  = ls_out-mat_cost.
    ls_sum-fd_mh          = ls_out-frght_duty.
    ls_sum-internal_labor = ls_out-labor_var  + ls_out-labor_fix
                          + ls_out-ovrhead_var + ls_out-ovrhead_fix
                          + ls_out-spec_act.
    ls_sum-external_labor = ls_out-ext_subcon + ls_out-serv_cost.
    ls_sum-total          = ls_sum-material_cost + ls_sum-fd_mh
                          + ls_sum-internal_labor + ls_sum-external_labor.

    COLLECT ls_sum INTO lt_sum.
  ENDLOOP.

  SORT lt_sum BY bukrs werks lgort zgroup.

  LOOP AT lt_sum INTO ls_sum.

    AT NEW lgort.
      NEW-LINE.
      WRITE: 34(18) 'Material Cost' RIGHT-JUSTIFIED,
            52(14) 'F&D/MH'        RIGHT-JUSTIFIED,
            66(18) 'Internal Lab.' RIGHT-JUSTIFIED,
            84(18) 'External Lab.' RIGHT-JUSTIFIED,
            102(18) 'Total'         RIGHT-JUSTIFIED.
      ULINE.
    ENDAT.

    AT NEW zgroup.
      NEW-LINE.
      WRITE: 4  ls_sum-zgroup,
              34(18) ls_sum-material_cost,
              52(14) ls_sum-fd_mh,
              66(18) ls_sum-internal_labor,
              84(18) ls_sum-external_labor,
              102(18) ls_sum-total.
      ULINE.
    ENDAT.

    AT END OF lgort.
      SUM.
      NEW-LINE.
      WRITE: 4  'TOTAL Storage Loc: ', ls_sum-lgort,
              34(18) ls_sum-material_cost  ,
              52(14) ls_sum-fd_mh          ,
              66(18) ls_sum-internal_labor ,
              84(18) ls_sum-external_labor ,
              102(18) ls_sum-total          .
      ULINE.
    ENDAT.

    AT END OF werks.
      SUM.
      NEW-LINE.
      WRITE: 4  'TOTAL Plant: ' COLOR COL_TOTAL, ls_sum-werks COLOR COL_TOTAL,
              34(18) ls_sum-material_cost  COLOR COL_TOTAL,
              52(14) ls_sum-fd_mh          COLOR COL_TOTAL,
              66(18) ls_sum-internal_labor COLOR COL_TOTAL,
              84(18) ls_sum-external_labor COLOR COL_TOTAL,
              102(18) ls_sum-total          COLOR COL_TOTAL.
      ULINE.
    ENDAT.

    AT END OF bukrs.
      SUM.
      NEW-LINE.
      WRITE: 4  'TOTAL Company Code: ' COLOR COL_POSITIVE, ls_sum-bukrs COLOR COL_POSITIVE,
              34(18) ls_sum-material_cost  COLOR COL_POSITIVE,
              52(14) ls_sum-fd_mh          COLOR COL_POSITIVE,
              66(18) ls_sum-internal_labor COLOR COL_POSITIVE,
              84(18) ls_sum-external_labor COLOR COL_POSITIVE,
              102(18) ls_sum-total          COLOR COL_POSITIVE.
      ULINE.
    ENDAT.

*    AT LAST.
*      SUM.
*      NEW-LINE.
*      WRITE: 4  'GRAND TOTAL' COLOR COL_POSITIVE,
*              34(18) ls_sum-material_cost  COLOR COL_POSITIVE,
*              52(14) ls_sum-fd_mh          COLOR COL_POSITIVE,
*              66(18) ls_sum-internal_labor COLOR COL_POSITIVE,
*              84(18) ls_sum-external_labor COLOR COL_POSITIVE,
*              102(18) ls_sum-total          COLOR COL_POSITIVE.
*    ENDAT.

  ENDLOOP.
ENDFORM.


FORM download_file.

  IF lt_output IS INITIAL.
    MESSAGE 'Not data to dowwnload' TYPE 'I'.
    RETURN.
  ENDIF.

  SORT lt_output BY werks lgort zmtart_output mtart matnr.

  IF p_xls = 'X'.
    PERFORM download_xlsx.
  ELSE.
    PERFORM download_txt.
  ENDIF.

ENDFORM.


FORM group_calt.

  DATA: lt_output_grouped TYPE STANDARD TABLE OF st_output WITH EMPTY KEY.

  SORT lt_output BY ersda matnr bukrs werks lgort sobkz
                    zmtart_output mtart maktx meins.

  LOOP AT lt_output INTO DATA(ls_line)
       GROUP BY ( ersda         = ls_line-ersda
                  matnr         = ls_line-matnr
                  bukrs         = ls_line-bukrs
                  werks         = ls_line-werks
                  lgort         = ls_line-lgort
                  sobkz         = ls_line-sobkz
                  zmtart_output = ls_line-zmtart_output
                  mtart         = ls_line-mtart
                  maktx         = ls_line-maktx
                  meins         = ls_line-meins )
       INTO DATA(ls_group).

    DATA(ls_sum) = VALUE st_output(
                     ersda         = ls_group-ersda
                     matnr         = ls_group-matnr
                     bukrs         = ls_group-bukrs
                     werks         = ls_group-werks
                     lgort         = ls_group-lgort
                     sobkz         = ls_group-sobkz
                     zmtart_output = ls_group-zmtart_output
                     mtart         = ls_group-mtart
                     maktx         = ls_group-maktx
                     meins         = ls_group-meins ).

    LOOP AT GROUP ls_group INTO DATA(ls_member).
      ls_sum-labst       += ls_member-labst.
      ls_sum-sap_value   += ls_member-sap_value.
      ls_sum-std_value   += ls_member-std_value.
      ls_sum-mat_cost    += ls_member-mat_cost.
      ls_sum-frght_duty  += ls_member-frght_duty.
      ls_sum-labor_var   += ls_member-labor_var.
      ls_sum-labor_fix   += ls_member-labor_fix.
      ls_sum-ext_subcon  += ls_member-ext_subcon.
      ls_sum-ovrhead_var += ls_member-ovrhead_var.
      ls_sum-ovrhead_fix += ls_member-ovrhead_fix.
      ls_sum-serv_cost   += ls_member-serv_cost.
      ls_sum-spec_act    += ls_member-spec_act.
    ENDLOOP.

    APPEND ls_sum TO lt_output_grouped.

  ENDLOOP.

  lt_output = lt_output_grouped.

ENDFORM.

FORM download_txt.

  DATA: lt_file TYPE TABLE OF string,
        lv_line TYPE string,
        lv_tab  TYPE c LENGTH 1.

  lv_tab = ';'.

  CONCATENATE 'ERSDA' 'MATNR' 'WERKS' 'LGORT' 'SOBKZ' 'ZMTART_OUTPUT'
              'MTART' 'MAKTX' 'LABST' 'MEINS' 'STD_VALUE'
              'MAT_COST' 'FRGHT_DUTY' 'LABOR_VAR' 'LABOR_FIX' 'EXT_SUBCON'
              'OVRHEAD_VAR' 'OVRHEAD_FIX' 'SERV_COST' 'SPEC_ACT'
         INTO lv_line SEPARATED BY lv_tab.
  APPEND lv_line TO lt_file.
  CLEAR lv_line.

  LOOP AT lt_output INTO DATA(ls_out).
    DATA(labst_str)       = ls_out-labst       && ''.
    DATA(std_value_str)   = ls_out-std_value   && ''.
    DATA(mat_cost_str)    = ls_out-mat_cost    && ''.
    DATA(frght_duty_str)  = ls_out-frght_duty  && ''.
    DATA(labor_var_str)   = ls_out-labor_var   && ''.
    DATA(labor_fix_str)   = ls_out-labor_fix   && ''.
    DATA(ext_subcon_str)  = ls_out-ext_subcon  && ''.
    DATA(ovrhead_var_str) = ls_out-ovrhead_var && ''.
    DATA(ovrhead_fix_str) = ls_out-ovrhead_fix && ''.
    DATA(serv_cost_str)   = ls_out-serv_cost   && ''.
    DATA(spec_act_str)    = ls_out-spec_act    && ''.

    CONCATENATE ls_out-ersda ls_out-matnr ls_out-werks ls_out-lgort
                ls_out-sobkz ls_out-zmtart_output ls_out-mtart ls_out-maktx
                labst_str ls_out-meins std_value_str
                mat_cost_str frght_duty_str labor_var_str
                labor_fix_str ext_subcon_str ovrhead_var_str
                ovrhead_fix_str serv_cost_str spec_act_str
           INTO lv_line SEPARATED BY lv_tab.
    APPEND lv_line TO lt_file.
    CLEAR lv_line.
  ENDLOOP.

  IF p_locl = 'X'.
    DATA(lv_path) = p_lpath && '\INVENTORY_COST_' && sy-datum && '.TXT'.
    cl_gui_frontend_services=>gui_download(
      EXPORTING
        filename = lv_path
        filetype = 'ASC'
      CHANGING
        data_tab = lt_file
      EXCEPTIONS
        OTHERS   = 1 ).
    IF sy-subrc <> 0.
      MESSAGE 'Error download file local' TYPE 'E'.
    ELSE.
      MESSAGE 'Download file success' TYPE 'S'.
    ENDIF.

  ELSE.
    OPEN DATASET p_spath FOR OUTPUT IN TEXT MODE ENCODING DEFAULT.
    IF sy-subrc <> 0.
      MESSAGE 'Can open file on server' TYPE 'E'.
      RETURN.
    ENDIF.
    LOOP AT lt_file INTO lv_line.
      TRANSFER lv_line TO p_spath.
    ENDLOOP.
    CLOSE DATASET p_spath.
    MESSAGE 'Download file success' TYPE 'S'.
  ENDIF.

ENDFORM.

FORM download_xlsx.

  DATA: lv_sheet_rows    TYPE string,
        lv_row           TYPE string,
        lv_row_num       TYPE i,
        lv_content_types TYPE string,
        lv_rels          TYPE string,
        lv_workbook      TYPE string,
        lv_wb_rels       TYPE string,
        lv_sheet_xml     TYPE string,
        lo_zip           TYPE REF TO cl_abap_zip,
        lv_xlsx_xstr     TYPE xstring,
        lt_bin           TYPE STANDARD TABLE OF sdokcntbin,
        lv_bin_size      TYPE i,
        lv_path          TYPE string.

  PERFORM xlsx_header_row CHANGING lv_row.
  lv_sheet_rows = lv_row.

  lv_row_num = 2.
  LOOP AT lt_output INTO DATA(ls_out).
    PERFORM xlsx_data_row USING ls_out lv_row_num CHANGING lv_row.
    lv_sheet_rows = |{ lv_sheet_rows }{ lv_row }|.
    lv_row_num = lv_row_num + 1.
  ENDLOOP.

  lv_content_types =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">| &&
    |<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>| &&
    |<Default Extension="xml" ContentType="application/xml"/>| &&
    |<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>| &&
    |<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>| &&
    |</Types>|.

  lv_rels =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">| &&
    |<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>| &&
    |</Relationships>|.

  lv_workbook =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">| &&
    |<sheets><sheet name="Inventory Cost" sheetId="1" r:id="rId1"/></sheets>| &&
    |</workbook>|.

  lv_wb_rels =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">| &&
    |<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>| &&
    |</Relationships>|.

  lv_sheet_xml =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">| &&
    |<sheetData>{ lv_sheet_rows }</sheetData>| &&
    |</worksheet>|.

  CREATE OBJECT lo_zip.
  lo_zip->add( name = '[Content_Types].xml'       content = cl_abap_codepage=>convert_to( lv_content_types ) ).
  lo_zip->add( name = '_rels/.rels'                content = cl_abap_codepage=>convert_to( lv_rels ) ).
  lo_zip->add( name = 'xl/workbook.xml'            content = cl_abap_codepage=>convert_to( lv_workbook ) ).
  lo_zip->add( name = 'xl/_rels/workbook.xml.rels' content = cl_abap_codepage=>convert_to( lv_wb_rels ) ).
  lo_zip->add( name = 'xl/worksheets/sheet1.xml'   content = cl_abap_codepage=>convert_to( lv_sheet_xml ) ).

  lv_xlsx_xstr = lo_zip->save( ).

  CALL FUNCTION 'SCMS_XSTRING_TO_BINARY'
    EXPORTING
      buffer        = lv_xlsx_xstr
    IMPORTING
      output_length = lv_bin_size
    TABLES
      binary_tab    = lt_bin.

  IF p_locl = 'X'.
    lv_path = p_lpath && '\INVENTORY_COST_' && sy-datum && '.XLSX'.
    cl_gui_frontend_services=>gui_download(
      EXPORTING
        bin_filesize = lv_bin_size
        filename     = lv_path
        filetype     = 'BIN'
      CHANGING
        data_tab     = lt_bin
      EXCEPTIONS
        OTHERS       = 1 ).
    IF sy-subrc <> 0.
      MESSAGE 'Error download file local' TYPE 'E'.
    ELSE.
      MESSAGE 'Download file success' TYPE 'S'.
    ENDIF.

  ELSE.
    OPEN DATASET p_spath FOR OUTPUT IN BINARY MODE.
    IF sy-subrc <> 0.
      MESSAGE 'Can open file on server' TYPE 'E'.
      RETURN.
    ENDIF.
    LOOP AT lt_bin INTO DATA(ls_bin).
      TRANSFER ls_bin-line TO p_spath.
    ENDLOOP.
    CLOSE DATASET p_spath.
    MESSAGE 'Download file success' TYPE 'S'.
  ENDIF.

ENDFORM.


FORM xlsx_header_row CHANGING cv_row TYPE string.

  DATA: lt_headers TYPE TABLE OF string,
        lv_cells   TYPE string,
        lv_col     TYPE i,
        lv_off     TYPE i,
        lv_letter  TYPE c LENGTH 1,
        lv_ref     TYPE string.

  lt_headers = VALUE #(
    ( `ERSDA` ) ( `MATNR` ) ( `WERKS` ) ( `LGORT` ) ( `SOBKZ` )
    ( `ZMTART_OUTPUT` ) ( `MTART` ) ( `MAKTX` ) ( `LABST` ) ( `MEINS` )
    ( `STD_VALUE` ) ( `MAT_COST` ) ( `FRGHT_DUTY` ) ( `LABOR_VAR` ) ( `LABOR_FIX` )
    ( `EXT_SUBCON` ) ( `OVRHEAD_VAR` ) ( `OVRHEAD_FIX` ) ( `SERV_COST` ) ( `SPEC_ACT` ) ).

  lv_col = 1.
  LOOP AT lt_headers INTO DATA(lv_h).
    lv_off    = lv_col - 1.
    lv_letter = sy-abcde+lv_off(1).
    lv_ref    = |{ lv_letter }1|.
    lv_cells  = |{ lv_cells }<c r="{ lv_ref }" t="inlineStr"><is><t>{ lv_h }</t></is></c>|.
    lv_col    = lv_col + 1.
  ENDLOOP.

  cv_row = |<row r="1">{ lv_cells }</row>|.
ENDFORM.


FORM xlsx_data_row USING is_out  TYPE st_output
                         iv_row TYPE i
                CHANGING cv_row TYPE string.

  DATA: lv_cells TYPE string,
        lv_col   TYPE i.

  lv_col = 1.

  PERFORM xlsx_add_text_cell USING iv_row is_out-ersda         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-matnr         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-werks         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-lgort         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-sobkz         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-zmtart_output CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-mtart         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-maktx         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-labst         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_text_cell USING iv_row is_out-meins         CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-std_value     CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-mat_cost      CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-frght_duty    CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-labor_var     CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-labor_fix     CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-ext_subcon    CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-ovrhead_var   CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-ovrhead_fix   CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-serv_cost     CHANGING lv_cells lv_col.
  PERFORM xlsx_add_num_cell  USING iv_row is_out-spec_act      CHANGING lv_cells lv_col.

  cv_row = |<row r="{ iv_row }">{ lv_cells }</row>|.
ENDFORM.


FORM xlsx_add_text_cell USING iv_row   TYPE i
                              iv_value TYPE any
                     CHANGING cv_cells TYPE string
                              cv_col   TYPE i.

  DATA: lv_off    TYPE i,
        lv_letter TYPE c LENGTH 1,
        lv_ref    TYPE string,
        lv_text   TYPE string.

  lv_off    = cv_col - 1.
  lv_letter = sy-abcde+lv_off(1).
  lv_ref    = |{ lv_letter }{ iv_row }|.

  lv_text = iv_value.
  REPLACE ALL OCCURRENCES OF '&' IN lv_text WITH '&amp;'.
  REPLACE ALL OCCURRENCES OF '<' IN lv_text WITH '&lt;'.
  REPLACE ALL OCCURRENCES OF '>' IN lv_text WITH '&gt;'.
  REPLACE ALL OCCURRENCES OF '"' IN lv_text WITH '&quot;'.

  cv_cells = |{ cv_cells }<c r="{ lv_ref }" t="inlineStr"><is><t>{ lv_text }</t></is></c>|.
  cv_col   = cv_col + 1.
ENDFORM.


FORM xlsx_add_num_cell USING iv_row   TYPE i
                             iv_value TYPE p
                    CHANGING cv_cells TYPE string
                             cv_col   TYPE i.

  DATA: lv_off    TYPE i,
        lv_letter TYPE c LENGTH 1,
        lv_ref    TYPE string,
        lv_num    TYPE string.

  lv_off    = cv_col - 1.
  lv_letter = sy-abcde+lv_off(1).
  lv_ref    = |{ lv_letter }{ iv_row }|.
  lv_num    = |{ iv_value NUMBER = RAW }|.

  cv_cells = |{ cv_cells }<c r="{ lv_ref }"><v>{ lv_num }</v></c>|.
  cv_col   = cv_col + 1.
ENDFORM.