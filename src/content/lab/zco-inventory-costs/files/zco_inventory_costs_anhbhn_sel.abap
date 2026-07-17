*&---------------------------------------------------------------------*
*& Include          ZCO_INVENTORY_COSTS_ANHBHN_SEL
*&---------------------------------------------------------------------*



SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-000.

  PARAMETERS:     p_date  TYPE sy-datum OBLIGATORY DEFAULT sy-datum..
  SELECT-OPTIONS: s_matnr FOR mara-matnr,
                  s_plant FOR mard-werks,
                  s_lgort FOR mard-lgort,
                  s_mtart FOR mara-mtart.


SELECTION-SCREEN END OF BLOCK b1.


SELECTION-SCREEN BEGIN OF BLOCK b2 WITH FRAME TITLE TEXT-001.
  SELECT-OPTIONS: p_mafert FOR mara-matnr,
                  p_mahalb FOR mara-matnr,
                  p_maroh  FOR mara-matnr.
    PARAMETERS: p_disp AS CHECKBOX DEFAULT 'X',
              p_down AS CHECKBOX.
SELECTION-SCREEN END OF BLOCK b2.


SELECTION-SCREEN BEGIN OF BLOCK b4 WITH FRAME TITLE TEXT-004.
    PARAMETERS: p_xls RADIOBUTTON GROUP rg11 DEFAULT 'X',
              p_txt RADIOBUTTON GROUP rg11.
SELECTION-SCREEN END OF BLOCK b4.


SELECTION-SCREEN BEGIN OF BLOCK b5 WITH FRAME TITLE TEXT-005.

  SELECTION-SCREEN BEGIN OF LINE.
    SELECTION-SCREEN POSITION 28.
    PARAMETERS: p_locl RADIOBUTTON GROUP rg12 DEFAULT 'X' USER-COMMAND uscom.
    SELECTION-SCREEN COMMENT (10) FOR FIELD p_locl.
    PARAMETERS: p_serv RADIOBUTTON GROUP rg12.
    SELECTION-SCREEN COMMENT (10) FOR FIELD p_serv.
  SELECTION-SCREEN END OF LINE.

  PARAMETERS: p_lpath TYPE localfile MODIF ID lp,
              p_spath TYPE rlgrap-filename DEFAULT '/usr/sap/interfaces/CO/' MODIF ID sp.

SELECTION-SCREEN END OF BLOCK b5.

AT SELECTION-SCREEN ON p_lpath.
  IF strlen( p_lpath ) = 0 AND p_down = 'X' AND p_locl = 'X'.
    MESSAGE 'Please enter path to download file' TYPE 'E'.
  ENDIF.

AT SELECTION-SCREEN ON p_spath.
  IF strlen( p_spath ) = 0 AND p_down = 'X' AND p_serv = 'X'.
    MESSAGE 'Please enter path to download file' TYPE 'E'.
  ENDIF.


AT SELECTION-SCREEN ON VALUE-REQUEST FOR p_lpath.

  DATA: lv_selected_folder TYPE string.

  cl_gui_frontend_services=>directory_browse(
    EXPORTING
      window_title         = 'Select folder to save file'
      initial_folder       = 'C:\'
    CHANGING
      selected_folder      = lv_selected_folder
    EXCEPTIONS
      cntl_error           = 1
      error_no_gui         = 2
      not_supported_by_gui = 3
      OTHERS               = 4
  ).

  IF sy-subrc = 0 AND lv_selected_folder IS NOT INITIAL.
    p_lpath = lv_selected_folder.
  ENDIF.


AT SELECTION-SCREEN OUTPUT.
  LOOP AT SCREEN.
    IF screen-group1 = 'SP'.
      IF p_locl = 'X'.
        screen-input = 0.
      ELSE.
        screen-input = 1.
      ENDIF.
      MODIFY SCREEN.
    ENDIF.

    IF screen-group1 = 'LP'.
      IF p_serv = 'X'.
        screen-input = 0.
      ELSE.
        screen-input = 1.
      ENDIF.
      MODIFY SCREEN.
    ENDIF.
  ENDLOOP.


START-OF-SELECTION.
  TRY.
    PERFORM check_authorization.

    IF p_disp = 'X'.
      PERFORM display.
    ENDIF.

    IF p_disp = 'X' AND p_down = 'X'.
      PERFORM group_calt.
      PERFORM download_file.
    ELSEIF p_down = 'X'.
      PERFORM clean_table.
      PERFORM get_material_key_information.
      PERFORM get_sales_orders.
      PERFORM get_controlling_area.
      PERFORM get_material_valuation.
      PERFORM get_product_costing.
      PERFORM get_cost_component.
      PERFORM calculate_cost.
      PERFORM group_calt.
      PERFORM download_file.
    ENDIF.

  CATCH cx_root INTO DATA(lx_error).
    MESSAGE lx_error->get_text( ) TYPE 'E'.
  ENDTRY.