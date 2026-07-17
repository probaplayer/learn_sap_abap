*&---------------------------------------------------------------------*
*& Report ZDAY9_EXE_02_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday9_exe_02_anhbhn.

TABLES: vbak, likp, vbrk, vbfa .

TYPES: BEGIN OF st_report,
         sale_vbeln     TYPE vbak-vbeln,
         sale_posnr     TYPE vbap-posnr,
         audat          TYPE vbak-audat,
         vkorg          TYPE vbak-vkorg,
         vkgrp          TYPE vbak-vkgrp,
         vkbur          TYPE vbak-vkbur,
         matnr          TYPE vbap-matnr,
         maktx          TYPE makt-maktx,
         matkl          TYPE vbap-matkl,
         delivery_vbeln TYPE likp-vbeln,
         delivery_posnr TYPE lips-posnr,
         vstel          TYPE likp-vstel,
         lfdat          TYPE likp-lfdat,
         werks          LIKE lips-werks,
         lgort          TYPE lips-lgort,
         kunnr          TYPE likp-kunnr,
         name1          TYPE kna1-name1,
         ort01          TYPE kna1-ort01,
         bill_vbeln     TYPE vbrk-vbeln,
         bill_posnr     TYPE vbrp-posnr,
         fkdat          TYPE vbrk-fkdat,
         bukrs          TYPE vbrk-bukrs,
         netwr          TYPE vbrk-netwr,
       END OF st_report.

TYPES: BEGIN OF st_dictionary,
         key   TYPE string,
         value TYPE string,
       END OF st_dictionary.

DATA: lt_report   TYPE TABLE OF st_report,
      lt_header   TYPE TABLE OF st_dictionary,
      wa_header   TYPE st_dictionary,
      it_fieldcat TYPE slis_t_fieldcat_alv,
      x_fieldcat  TYPE slis_fieldcat_alv,
      it_sort     TYPE slis_t_sortinfo_alv,
      wa_sort     TYPE slis_sortinfo_alv.
.


lt_header = VALUE #(
    ( key = 'SALE_VBELN'      value = 'Sales document number' )
    ( key = 'SALE_POSNR'      value = 'Sales document item' )
    ( key = 'AUDAT'           value = 'SD creation date' )
    ( key = 'VKORG'           value = 'Sales Organization' )
    ( key = 'VKGRP'           value = 'Sales group' )
    ( key = 'VKBUR'           value = 'Sales office' )
    ( key = 'MATNR'           value = 'Material' )
    ( key = 'MAKTX'           value = 'Material Description' )
    ( key = 'MATKL'           value = 'Material Group' )
    ( key = 'DELIVERY_VBELN'  value = 'Delivery Document Number' )
    ( key = 'DELIVERY_POSNR'  value = 'Delivery Document Item' )
    ( key = 'VSTEL'           value = 'Shipping Point' )
    ( key = 'LFDAT'           value = 'Delivery Date' )
    ( key = 'WERKS'           value = 'Plant' )
    ( key = 'LGORT'           value = 'Storage Location' )
    ( key = 'KUNNR'           value = 'Ship-to Party' )
    ( key = 'NAME1'           value = 'Ship-to Party Name' )
    ( key = 'ORT01'           value = 'Ship-to Party City' )
    ( key = 'BILL_VBELN'      value = 'Billing Document Number' )
    ( key = 'BILL_POSNR'      value = 'Billing Document Item' )
    ( key = 'FKDAT'           value = 'Billing Date' )
    ( key = 'BUKRS'           value = 'Company Code' )
    ( key = 'NETWR'           value = 'Net Value' )
).


LOOP AT lt_header INTO wa_header.
  x_fieldcat-fieldname = wa_header-key.
  x_fieldcat-seltext_l = wa_header-value.
  x_fieldcat-tabname   = 'LT_REPORT'.
  x_fieldcat-col_pos   = sy-tabix.

  IF wa_header-key = 'SALE_VBELN' OR wa_header-key = 'DELIVERY_VBELN' OR wa_header-key = 'BILL_VBELN'.
    x_fieldcat-emphasize = 'C400'.
    IF wa_header-key = 'BILL_VBELN'.
      CLEAR wa_sort.
      wa_sort-fieldname = wa_header-key.
      wa_sort-subtot    = 'X'.
      APPEND wa_sort TO it_sort.
    ENDIF.
  ELSEIF wa_header-key = 'NETWR'.
    x_fieldcat-do_sum = 'X'.
  ELSEIF wa_header-key = 'BUKRS'.
    CLEAR wa_sort.
    wa_sort-fieldname = wa_header-key.
    wa_sort-subtot    = 'X'.
    APPEND wa_sort TO it_sort.
  ENDIF.


  APPEND x_fieldcat TO it_fieldcat.
  CLEAR x_fieldcat.
ENDLOOP.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-000.

  PARAMETERS: p_saldoc RADIOBUTTON GROUP grdo DEFAULT 'X' USER-COMMAND ucomm,
              p_delfoc RADIOBUTTON GROUP grdo,
              p_bildoc RADIOBUTTON GROUP grdo
              .

  SELECT-OPTIONS: s_vbeln FOR vbak-vbeln MODIF ID sal,
                   s_delnr FOR likp-vbeln MODIF ID del,
                   s_bilnr FOR vbrk-vbeln MODIF ID bil.


SELECTION-SCREEN END OF BLOCK b1.

SELECTION-SCREEN BEGIN OF BLOCK b2 WITH FRAME TITLE TEXT-001.

  PARAMETERS: p_dis  AS CHECKBOX DEFAULT 'X',
              p_mail AS CHECKBOX USER-COMMAND ucomm,
              p_down AS CHECKBOX DEFAULT 'X' USER-COMMAND ucomm
              .

  PARAMETERS p_lpath TYPE localfile MODIF ID pth DEFAULT 'D:\'.
  SELECT-OPTIONS s_user FOR sy-uname NO INTERVALS MODIF ID usr.

SELECTION-SCREEN END OF BLOCK b2.

AT SELECTION-SCREEN ON VALUE-REQUEST FOR p_lpath.

  DATA: w_selected_folder TYPE string.

  cl_gui_frontend_services=>directory_browse(
    EXPORTING
      window_title         = 'Select folder to save file'
      initial_folder       = 'C:\'
    CHANGING
      selected_folder      = w_selected_folder
    EXCEPTIONS
      cntl_error           = 1
      error_no_gui         = 2
      not_supported_by_gui = 3
      OTHERS               = 4
  ).

  IF sy-subrc = 0 AND w_selected_folder IS NOT INITIAL.
    p_lpath = w_selected_folder.
  ENDIF.


*AT SELECTION-SCREEN ON p_lpath.
*  IF p_down = 'X' AND strlen( p_lpath ) = 0.
*    MESSAGE 'Please enter the path to download file' TYPE 'E'.
*  ENDIF.


AT SELECTION-SCREEN OUTPUT.
  LOOP AT SCREEN.

    CASE screen-group1.
      WHEN 'SAL'.
        IF p_saldoc = abap_true.
          screen-input = 1.
        ELSE.
          screen-input = 0.
        ENDIF.
        MODIFY SCREEN.

      WHEN 'DEL'.
        IF p_delfoc = abap_true.
          screen-input = 1.
        ELSE.
          screen-input = 0.
        ENDIF.
        MODIFY SCREEN.

      WHEN 'BIL'.
        IF p_bildoc = abap_true.
          screen-input = 1.
        ELSE.
          screen-input = 0.
        ENDIF.
        MODIFY SCREEN.

      WHEN 'PTH'.
        IF p_down = abap_true.
          screen-active = 1.
        ELSE.
          screen-active = 0.
        ENDIF.
        MODIFY SCREEN.
      WHEN 'USR'.
        IF p_mail = abap_true.
          screen-active = 1.
        ELSE.
          screen-active = 0.
        ENDIF.
        MODIFY SCREEN.

    ENDCASE.

  ENDLOOP.

START-OF-SELECTION.
  TRY.
    DATA is_valid TYPE abap_bool.

    PERFORM get_data.
    PERFORM validate CHANGING is_valid.

    IF is_valid = abap_false.
      RETURN.
    ENDIF.

    IF p_down = 'X'.
      PERFORM download.
    ENDIF.

    IF p_mail = 'X'.
      PERFORM sendmail.
    ENDIF.

    IF p_dis = 'X'.
      PERFORM display.
    ENDIF.
  CATCH cx_root INTO DATA(lx_error).
    MESSAGE lx_error->get_text( ) TYPE 'E'.
  ENDTRY.


FORM validate CHANGING w_valid TYPE abap_bool.
  w_valid = abap_false.
  IF p_down = 'X' AND strlen( p_lpath ) = 0.
    MESSAGE 'Please enter the path to download file' TYPE 'I'.
    EXIT.
  ELSEIF lt_report IS INITIAL.
    MESSAGE 'No valid data found.' TYPE 'I'.
    EXIT.
  ELSEIF p_mail = 'X' AND s_user IS INITIAL.
    MESSAGE 'Please enter user to send mail.' TYPE 'I'.
    EXIT.
  ELSE.
    w_valid = abap_true.
    EXIT.
  ENDIF.

ENDFORM.

FORM get_data.

  CLEAR lt_report.

  SELECT vbak~vbeln     AS sale_vbeln,
       vbap~posnr       AS sale_posnr,
       vbak~audat       AS audat,
       vbak~vkorg       AS vkorg,
       vbak~vkgrp       AS vkgrp,
       vbak~vkbur       AS vkbur,
       vbap~matnr       AS matnr,
       makt~maktx       AS maktx,
       vbap~matkl       AS matkl,
       likp~vbeln       AS delivery_vbeln,
       lips~posnr       AS delivery_posnr,
       likp~vstel       AS vstel,
       likp~lfdat       AS lfdat,
       lips~werks       AS werks,
       lips~lgort       AS lgort,
       likp~kunnr       AS kunnr,
       kna1~name1       AS name1,
       kna1~ort01       AS ort01,
       vbrk~vbeln       AS bill_vbeln,
       vbrp~posnr       AS bill_posnr,
       vbrk~fkdat       AS fkdat,
       vbrk~bukrs       AS bukrs,
       vbrk~netwr       AS netwr
  FROM vbak
  INNER JOIN vbap
    ON vbap~vbeln = vbak~vbeln
  LEFT OUTER JOIN makt
    ON makt~matnr = vbap~matnr
   AND makt~spras = @sy-langu
  LEFT OUTER JOIN vbfa AS vbfa_dlv
    ON vbfa_dlv~vbelv    = vbap~vbeln
   AND vbfa_dlv~posnv    = vbap~posnr
   AND vbfa_dlv~vbtyp_n  = 'J'
  LEFT OUTER JOIN lips
    ON lips~vbeln = vbfa_dlv~vbeln
   AND lips~posnr = vbfa_dlv~posnn
  LEFT OUTER JOIN likp
    ON likp~vbeln = lips~vbeln
  LEFT OUTER JOIN kna1
    ON kna1~kunnr = likp~kunnr
  LEFT OUTER JOIN vbfa AS vbfa_inv
    ON vbfa_inv~vbelv    = lips~vbeln
   AND vbfa_inv~posnv    = lips~posnr
   AND vbfa_inv~vbtyp_n  = 'M'
  LEFT OUTER JOIN vbrp
    ON vbrp~vbeln = vbfa_inv~vbeln
   AND vbrp~posnr = vbfa_inv~posnn
  LEFT OUTER JOIN vbrk
    ON vbrk~vbeln = vbrp~vbeln
  WHERE
*    ( @( xsdbool( p_saldoc = abap_true AND s_vbeln IS NOT INITIAL ) ) = @abap_true
*      AND vbak~vbeln IN @s_vbeln )
*    OR
*    ( @( xsdbool( p_delfoc = abap_true AND s_delnr IS NOT INITIAL ) ) = @abap_true
*      AND likp~vbeln IN @s_delnr )
*    OR
*    ( @( xsdbool( p_bildoc = abap_true AND s_bilnr IS NOT INITIAL ) ) = @abap_true
*      AND vbrk~vbeln IN @s_bilnr )

   ( @p_saldoc = @abap_true AND vbak~vbeln IN @s_vbeln )
    OR
    ( @p_delfoc = @abap_true AND likp~vbeln IN @s_delnr )
    OR
    ( @p_bildoc = @abap_true AND vbrk~vbeln IN @s_bilnr )
  ORDER BY
    vbak~vbeln, likp~vbeln, vbrk~vbeln
  INTO TABLE @lt_report
    .

ENDFORM.

FORM display.
  CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
    EXPORTING
      i_grid_title  = 'Sales - Delivery - Billing Report'
      it_fieldcat   = it_fieldcat
      it_sort       = it_sort
    TABLES
      t_outtab      = lt_report
    EXCEPTIONS
      program_error = 1
      OTHERS        = 2.

  IF sy-subrc <> 0.
    MESSAGE 'Show data failed' TYPE 'E'.
  ENDIF.
ENDFORM.

FORM download.

  DATA: lt_data      TYPE TABLE OF string,
        w_line      TYPE string,
        w_file_name TYPE string,
        w_full_path TYPE string.

  CLEAR w_line.
  LOOP AT lt_header INTO wa_header.
    IF w_line IS INITIAL.
      w_line = wa_header-value.
    ELSE.
      w_line = w_line && cl_abap_char_utilities=>horizontal_tab && wa_header-value.
    ENDIF.
  ENDLOOP.
  APPEND w_line TO lt_data.

  LOOP AT lt_report INTO DATA(wa_report).
    CLEAR w_line.
    w_line =
        wa_report-sale_vbeln     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-sale_posnr     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-audat          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vkorg          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vkgrp          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vkbur          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-matnr          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-maktx          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-matkl          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-delivery_vbeln && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-delivery_posnr && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vstel          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-lfdat          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-werks          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-lgort          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-kunnr          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-name1          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-ort01          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-bill_vbeln     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-bill_posnr     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-fkdat          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-bukrs          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-netwr.

    APPEND w_line TO lt_data.

  ENDLOOP.

  w_file_name = 'sale_delivery_bill_' && sy-datum && '.xls'.
  w_full_path = p_lpath && '\' && w_file_name.

  CALL FUNCTION 'GUI_DOWNLOAD'
    EXPORTING
      filename                = w_full_path
      filetype                = 'ASC'
      write_field_separator   = abap_false
      codepage                = '4103'
      write_bom               = 'X'
    TABLES
      data_tab                = lt_data
    EXCEPTIONS
      file_write_error        = 1
      no_batch                = 2
      gui_refuse_filetransfer = 3
      invalid_type            = 4
      no_authority             = 5
      unknown_error            = 6
      header_not_allowed       = 7
      separator_not_allowed    = 8
      filesize_not_allowed     = 9
      header_too_long          = 10
      dp_error_create          = 11
      dp_error_send            = 12
      dp_error_write           = 13
      unknown_dp_error         = 14
      access_denied            = 15
      dp_out_of_memory         = 16
      disk_full                = 17
      dp_timeout               = 18
      file_not_found           = 19
      dataprovider_exception   = 20
      control_flush_error      = 21
      OTHERS                   = 22.

  IF sy-subrc <> 0.
    MESSAGE 'Download file failed.' TYPE 'E'.
  ELSE.
    MESSAGE 'Download success.' TYPE 'S'.
  ENDIF.

ENDFORM.

FORM sendmail.
  DATA: lt_body         TYPE TABLE OF solisti1,
        lt_attach       TYPE TABLE OF solisti1,
        lt_receivers    TYPE TABLE OF somlreci1,
        lt_packing_list TYPE TABLE OF sopcklsti1.

  DATA: wa_doc_data     TYPE sodocchgi1,
        wa_body         TYPE solisti1,
        wa_attach       TYPE solisti1,
        wa_receiver     TYPE somlreci1,
        wa_packing_list TYPE sopcklsti1,
        wa_line         TYPE string.

  DATA(lt_body_str) = VALUE string_table(
    ( `Hello` )
    ( `This is the report sale_delivery_bill, please check` )
    ( `SAP dev` )
    ( `sincerely` )
  ).

  LOOP AT lt_body_str INTO DATA(w_line).
    wa_body-line = w_line.
    APPEND wa_body TO lt_body.
    CLEAR wa_body.
  ENDLOOP.

  LOOP AT lt_report INTO DATA(wa_report).
    CLEAR wa_line.
    wa_line =
        wa_report-sale_vbeln     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-sale_posnr     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-audat          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vkorg          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vkgrp          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vkbur          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-matnr          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-maktx          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-matkl          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-delivery_vbeln && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-delivery_posnr && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-vstel          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-lfdat          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-werks          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-lgort          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-kunnr          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-name1          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-ort01          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-bill_vbeln     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-bill_posnr     && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-fkdat          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-bukrs          && cl_abap_char_utilities=>horizontal_tab &&
        wa_report-netwr.

    wa_attach-line = wa_line.
    APPEND wa_attach TO lt_attach.
    CLEAR wa_attach.
  ENDLOOP.

  CLEAR wa_packing_list.
  wa_packing_list-transf_bin = space.
  wa_packing_list-head_start = 1.
  wa_packing_list-head_num   = 1.
  wa_packing_list-body_start = 1.
  wa_packing_list-body_num   = lines( lt_attach ).
  wa_packing_list-doc_type   = 'CSV'.
  wa_packing_list-obj_name   = 'ATTACHMENT'.
  wa_packing_list-obj_descr  = 'sale_delivery_bill_' && sy-datum && '.csv'.
  wa_packing_list-doc_size   = lines( lt_attach ) * 255.
  APPEND wa_packing_list TO lt_packing_list.

  wa_doc_data-obj_name   = 'REPORT'.
  wa_doc_data-obj_descr  = 'Report from ZDAY9_EXE_02_ANHBHN'.
  wa_doc_data-sensitivty = 'F'.
  wa_doc_data-doc_size   = 255.

  DATA(w_lines) = lines( lt_body ).
  CLEAR wa_packing_list.
  wa_packing_list-transf_bin = space.
  wa_packing_list-head_start = 1.
  wa_packing_list-head_num   = 0.
  wa_packing_list-body_start = 1.
  wa_packing_list-body_num   = w_lines.
  wa_packing_list-doc_type   = 'RAW'.
  APPEND wa_packing_list TO lt_packing_list.

  LOOP AT s_user.
    CLEAR wa_receiver.
    wa_receiver-receiver   = s_user-low && '@kstns.biz'.
    wa_receiver-rec_type   = 'U'.
    wa_receiver-com_type   = 'INT'.
    wa_receiver-notif_del  = 'X'.
    wa_receiver-notif_ndel = 'X'.
    APPEND wa_receiver TO lt_receivers.
  ENDLOOP.

  CLEAR wa_line.
  LOOP AT lt_header INTO wa_header.
    IF wa_line IS INITIAL.
      wa_line = wa_header-value.
    ELSE.
      wa_line = wa_line && cl_abap_char_utilities=>horizontal_tab && wa_header-value.
    ENDIF.
  ENDLOOP.
  wa_attach-line = wa_line.
  APPEND wa_attach TO lt_attach.
  CLEAR wa_attach.


  CALL FUNCTION 'SO_NEW_DOCUMENT_ATT_SEND_API1'
    EXPORTING
      document_data              = wa_doc_data
      put_in_outbox               = 'X'
      commit_work                 = 'X'
    TABLES
      packing_list                 = lt_packing_list
      contents_txt                  = lt_body
      contents_bin                  = lt_attach
      receivers                     = lt_receivers
    EXCEPTIONS
      too_many_receivers              = 1
      document_not_sent               = 2
      document_type_not_exist         = 3
      operation_no_authorization      = 4
      parameter_error                 = 5
      x_error                         = 6
      enqueue_error                   = 7
      OTHERS                          = 8.

  IF sy-subrc <> 0.
    MESSAGE 'Send mail failed' TYPE 'I'.
  ELSE.
    MESSAGE 'Send mail success' TYPE 'S'.
  ENDIF.

ENDFORM.