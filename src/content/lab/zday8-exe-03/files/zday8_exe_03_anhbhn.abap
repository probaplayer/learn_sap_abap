*&---------------------------------------------------------------------*
*& Report ZDAY8_EXE_03_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT ZDAY8_EXE_03_ANHBHN.

DATA: lv_value TYPE c LENGTH 10.

PARAMETERS p_value TYPE c LENGTH 10.

SELECTION-SCREEN BEGIN OF LINE.
  SELECTION-SCREEN PUSHBUTTON 50(20) TEXT-001 USER-COMMAND btn_abap_memory.
SELECTION-SCREEN END OF LINE.

SELECTION-SCREEN BEGIN OF LINE.
  SELECTION-SCREEN PUSHBUTTON 50(20) TEXT-002 USER-COMMAND btn_sap_memory.
SELECTION-SCREEN END OF LINE.

SELECTION-SCREEN BEGIN OF LINE.
  SELECTION-SCREEN PUSHBUTTON 50(20) TEXT-003 USER-COMMAND btn_move.
SELECTION-SCREEN END OF LINE.

AT SELECTION-SCREEN.
  CASE sy-ucomm.
    WHEN 'BTN_ABAP_MEMORY'.
      PERFORM save_value_with_abap_memory.
    WHEN 'BTN_SAP_MEMORY'.
      PERFORM save_value_with_sap_memory.
    WHEN 'BTN_MOVE'.
      PERFORM move.
  ENDCASE.


FORM save_value_with_abap_memory.

  lv_value = p_value.
  EXPORT lv_value TO MEMORY ID 'ZVAL_ABAP'.
  SUBMIT ztest_code AND RETURN.

ENDFORM.


FORM save_value_with_sap_memory.

  SET PARAMETER ID 'ZVAL_SAP' FIELD p_value.
  SUBMIT ztest_code AND RETURN.

ENDFORM.

FORM move.

  SUBMIT ztest_code AND RETURN.

ENDFORM.