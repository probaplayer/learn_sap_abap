*&---------------------------------------------------------------------*
*& Report ZDAY5_EXE_02_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday5_exe_02_anhbhn.

TYPES: BEGIN OF ty_dictionary,
         key   TYPE string,
         value TYPE string,
       END OF ty_dictionary.

TYPES: ty_dictionaries TYPE HASHED TABLE OF ty_dictionary
                    WITH UNIQUE KEY key.

DATA: tt_operator TYPE TABLE OF string,
      w_vld_b TYPE string,
      w_vld_o TYPE string.

SELECTION-SCREEN BEGIN OF BLOCK calculator
  WITH FRAME TITLE TEXT-000.

  SELECTION-SCREEN BEGIN OF BLOCK input_operands
    WITH FRAME TITLE TEXT-001.
      PARAMETERS p_a TYPE i OBLIGATORY.
      PARAMETERS p_b TYPE i OBLIGATORY.
      SELECTION-SCREEN COMMENT /1(25) cmt1.
  SELECTION-SCREEN END OF BLOCK input_operands.

  SELECTION-SCREEN BEGIN OF BLOCK input_operator
    WITH FRAME TITLE TEXT-002.
      PARAMETERS p_o TYPE c LENGTH 1 OBLIGATORY.
      SELECTION-SCREEN COMMENT /1(25) cmt2.
  SELECTION-SCREEN END OF BLOCK input_operator.

SELECTION-SCREEN END OF BLOCK calculator.

INITIALIZATION.
  w_vld_b = ''.
  w_vld_o = ''.

  tt_operator = VALUE #(
      ( `-` )
      ( `+` )
      ( `*` )
      ( `/` )
    ).

   DATA(validate_msg) = VALUE ty_dictionaries(
      ( key = 'msg001' value = 'Invalid operator: {0}.' )
      ( key = 'msg002' value = 'Cannot divide by 0.' )
   ).

AT SELECTION-SCREEN ON p_o.
  w_vld_o = ''.
  DATA(invalid_msg) = ``.
  READ TABLE tt_operator
       TRANSPORTING NO FIELDS
       WITH KEY table_line = p_o.
  IF sy-subrc <> 0.
    w_vld_o = 'msg001'.
    invalid_msg = validate_msg[ key = w_vld_o ]-value.
    REPLACE '{0}' IN invalid_msg WITH p_o.
    w_vld_o = abap_true.
    MESSAGE invalid_msg TYPE 'E'.
  ENDIF.

AT SELECTION-SCREEN ON p_b.
  w_vld_b = ''.
  IF p_o = '/' AND p_b = 0.
    w_vld_b = 'msg002'.
    MESSAGE validate_msg[ key = w_vld_b ]-value TYPE 'E'.
  ENDIF.

START-OF-SELECTION.
  DATA: result TYPE p DECIMALS 2.

  IF p_o = '+'.
    result = p_a + p_b.
  ELSEIF p_o = '-'.
    result = p_a - p_b.
  ELSEIF p_o = '*'.
    result = p_a * p_b.
  ELSEIF p_o = '/'.
    result = p_a / p_b.
  ENDIF.

  WRITE: / 'Result:', result.

AT SELECTION-SCREEN OUTPUT.
  cmt1 = ''.
  cmt2 = ''.
  IF strlen( w_vld_b ) <> 0.
    cmt1 = validate_msg[ key = w_vld_b ]-value.
  ENDIF.

  IF strlen( w_vld_o ) <> 0.
    cmt2 = validate_msg[ key = w_vld_o ]-value.
  ENDIF.