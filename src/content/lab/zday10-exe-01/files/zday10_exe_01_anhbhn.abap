*&---------------------------------------------------------------------*
*& Report ZDAY10_EXE_01_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT ZDAY10_EXE_01_ANHBHN.

PARAMETERS: p_vbeln TYPE vbrk-vbeln.

DATA w_fname TYPE rs38l_fnam.

CALL FUNCTION 'SSF_FUNCTION_MODULE_NAME'
  EXPORTING  formname           = 'ZDAY10_EXE_01_ANHBHN'
  IMPORTING  fm_name            = w_fname
  EXCEPTIONS no_form            = 1
             no_function_module = 2
             OTHERS             = 3.
IF sy-subrc <> 0.
  MESSAGE 'Call smartform failed' TYPE 'E'.
ENDIF.

CALL FUNCTION w_fname
  EXPORTING  iv_vblen = p_vbeln
  EXCEPTIONS formatting_error = 1
             internal_error   = 2
             send_error       = 3
             user_canceled    = 4
             OTHERS           = 5.