*&---------------------------------------------------------------------*
*& Report ZTEST_CODE
*&---------------------------------------------------------------------*
REPORT ztest_code.

DATA: lv_value TYPE c LENGTH 10.

INITIALIZATION.
  PERFORM get_value_abap_memory.
  PERFORM get_value_sap_memory.

FORM get_value_abap_memory.

  IMPORT lv_value FROM MEMORY ID 'ZVAL_ABAP'.

  IF sy-subrc = 0.
    WRITE: / 'Giá trị lấy từ ABAP Memory:', lv_value.
  ELSE.
    WRITE: / 'Không có dữ liệu trong ABAP Memory ID ZDOC'.
  ENDIF.

  FREE MEMORY ID 'ZVAL_ABAP'.

ENDFORM.


FORM get_value_sap_memory.

  GET PARAMETER ID 'ZVAL_SAP' FIELD lv_value.
  IF sy-subrc = 0.
    WRITE: / 'Giá trị lấy từ SAP Memory:', lv_value.
  ELSE.
    WRITE: / 'Không có dữ liệu trong SAP Memory ID ZVAL'.
  ENDIF.

ENDFORM.