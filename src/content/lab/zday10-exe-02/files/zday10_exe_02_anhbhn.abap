*&---------------------------------------------------------------------*
*& Report ZDAY10_EXE_02_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday10_exe_02_anhbhn.


DATA: lt_sales    TYPE TABLE OF vbak,
      wa_cus      TYPE kna1,
      it_sale_fc TYPE slis_t_fieldcat_alv,
      it_cus_fc TYPE slis_t_fieldcat_alv,
      x_fieldcat  TYPE slis_fieldcat_alv,
      x_layout    TYPE slis_layout_alv.

x_layout-colwidth_optimize = 'X'.

CALL FUNCTION 'REUSE_ALV_FIELDCATALOG_MERGE'
  EXPORTING
    i_structure_name       = 'VBAK'
  CHANGING
    ct_fieldcat            = it_sale_fc
  EXCEPTIONS
    inconsistent_interface = 1
    program_error          = 2
    OTHERS                 = 3.

LOOP AT it_sale_fc INTO x_fieldcat.
  CASE x_fieldcat-fieldname.
    WHEN 'ERDAT' OR 'VBTYP' OR 'VKORG' OR 'VTWEG'
      OR 'SPART' OR 'VKGRP' OR 'VKBUR'.
*       keep these columns visible
    WHEN 'VBELN' OR 'KUNNR'.
      x_fieldcat-hotspot = 'X'.
    WHEN OTHERS.
      x_fieldcat-no_out = 'X'.
  ENDCASE.
  MODIFY it_sale_fc FROM x_fieldcat.
ENDLOOP.

CALL FUNCTION 'REUSE_ALV_FIELDCATALOG_MERGE'
  EXPORTING
    i_structure_name = 'KNA1'
  CHANGING
    ct_fieldcat      = it_cus_fc
  EXCEPTIONS
    inconsistent_interface = 1
    program_error          = 2
    OTHERS                 = 3.

CLEAR x_fieldcat.
LOOP AT it_cus_fc INTO x_fieldcat.
  CASE x_fieldcat-fieldname.
    WHEN 'KUNNR' OR 'NAME1' OR 'STRAS' OR 'ORT01'
      OR 'REGIO' OR 'PSTLZ'.
*       keep these columns visible
    WHEN OTHERS.
      x_fieldcat-no_out = 'X'.
  ENDCASE.
  MODIFY it_cus_fc FROM x_fieldcat.
ENDLOOP.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-000.

  PARAMETERS: p_sale   TYPE vbak-vbeln,
              p_date   TYPE vbak-erdat,
              p_sleOrg TYPE vbak-vkorg,
              p_layout TYPE disvariant-variant.

SELECTION-SCREEN END OF BLOCK b1.


START-OF-SELECTION.
  PERFORM display.

FORM display.
  PERFORM get_data.

  CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
    EXPORTING
      i_callback_program      = sy-repid
      i_grid_title            = 'SALES ORDER ACKNOWLEDGEMENT DISPLAY'
      i_callback_user_command = 'USER_COMMAND'
      is_layout               = x_layout
      it_fieldcat             = it_sale_fc
    TABLES
      t_outtab                = lt_sales
    EXCEPTIONS
      program_error           = 1
      OTHERS                  = 2.

ENDFORM.

FORM get_data.

  SELECT * FROM vbak
    WHERE
      ( @p_sale IS INITIAL OR VBAK~VBELN = @p_sale )
    AND ( @p_date IS INITIAL OR VBAK~ERDAT = @p_date )
    AND ( @p_sleOrg IS INITIAL OR VBAK~VKORG = @p_sleOrg )
    INTO TABLE @lt_sales.

ENDFORM.

FORM user_command USING r_ucomm     LIKE sy-ucomm
                         rs_selfield TYPE slis_selfield.

  DATA: wa_sales TYPE vbak.

  READ TABLE lt_sales INTO wa_sales INDEX rs_selfield-tabindex.
  IF sy-subrc = 0.
    CASE rs_selfield-fieldname.
      WHEN 'VBELN'.
        PERFORM display_smartforms USING wa_sales-vbeln.
      WHEN 'KUNNR'.
        PERFORM get_customer USING wa_sales-kunnr.
    ENDCASE.
  ENDIF.

ENDFORM.

FORM display_smartforms USING w_vbeln TYPE VBAK-vbeln.

  DATA w_fname TYPE rs38l_fnam.

  CALL FUNCTION 'SSF_FUNCTION_MODULE_NAME'
    EXPORTING  formname           = 'ZDAY10_EXE_02_ANHBHN'
    IMPORTING  fm_name            = w_fname
    EXCEPTIONS no_form            = 1
               no_function_module = 2
               OTHERS             = 3.
  IF sy-subrc <> 0.
    MESSAGE 'Call smartform failed' TYPE 'E'.
  ENDIF.

  CALL FUNCTION w_fname
    EXPORTING  IV_VBELN = w_vbeln
    EXCEPTIONS formatting_error = 1
               internal_error   = 2
               send_error       = 3
               user_canceled    = 4
               OTHERS           = 5.

ENDFORM.


FORM get_customer USING w_kunnr TYPE kna1-kunnr.

  DATA: lt_cus TYPE TABLE OF kna1,
        lt_cus_fc TYPE slis_t_fieldcat_alv.

  SELECT SINGLE * INTO wa_cus
    FROM kna1
    WHERE kunnr = w_kunnr
  .

  IF sy-subrc = 0.
    APPEND wa_cus TO lt_cus.

    CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
      EXPORTING
        i_grid_title        = 'SALE　ORDER'
        it_fieldcat         = it_cus_fc
        i_screen_start_column = 0
        i_screen_start_line   = 5
        i_screen_end_column   = 100
        i_screen_end_line     = 7
        is_layout     = x_layout
      TABLES
        t_outtab            = lt_cus
      EXCEPTIONS
        program_error = 1
        OTHERS        = 2.
  ELSE.
    MESSAGE 'Customer not found' TYPE 'I'.
  ENDIF.

ENDFORM.