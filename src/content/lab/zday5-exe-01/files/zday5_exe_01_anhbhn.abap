*&---------------------------------------------------------------------*
*& Report ZDAY5_EXE_01_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday5_exe_01_anhbhn.

TABLES: vbak.

SELECTION-SCREEN BEGIN OF BLOCK information
  WITH FRAME TITLE TEXT-000.

  SELECT-OPTIONS: s_vkorg FOR vbak-vkorg.
  SELECT-OPTIONS: s_vtweg FOR vbak-vtweg.
  PARAMETERS p_spart TYPE spart.
  PARAMETERS p_uprice AS CHECKBOX.

SELECTION-SCREEN END OF BLOCK information.


SELECTION-SCREEN BEGIN OF BLOCK action
  WITH FRAME TITLE TEXT-001.

  PARAMETERS P_Down RADIOBUTTON GROUP gact.
  PARAMETERS P_Dfile TYPE string.
  PARAMETERS p_up RADIOBUTTON GROUP gact.
  PARAMETERS P_Ufile TYPE string.

SELECTION-SCREEN END OF BLOCK action.

AT SELECTION-SCREEN ON s_vkorg.
  IF s_vkorg IS INITIAL.
    EXIT.
  ENDIF.
  IF '0002' IN s_vkorg OR '0003' IN s_vkorg.
    MESSAGE 'The sales organization (0002/0003) can not access now' TYPE 'E'.
  ENDIF.

START-OF-SELECTION.
  MESSAGE 'Program executes without error' TYPE 'S'.
  PERFORM build_screen_output.


FORM build_screen_output.

  PERFORM Print_Range USING 'Sales org: ' s_vkorg[].

  ULINE.
  PERFORM Print_Range USING 'Distribution channel: ' s_vtweg[].

  ULINE.
  WRITE: / 'Division:', AT 30 COND #( WHEN p_spart = '' THEN 'NONE' ELSE p_spart ).

  ULINE.
  WRITE: / 'Include update pricing:', AT 30
           COND #( WHEN p_uprice = 'X' THEN 'YES' ELSE 'NO' ).

ENDFORM.


FORM Print_Range USING w_label TYPE string
                       s_range TYPE ANY TABLE.
  DATA: w_firstLine TYPE abap_bool.
  FIELD-SYMBOLS: <w_range> TYPE any,
                 <w_sign>  TYPE any,
                 <w_low>   TYPE any,
                 <w_high>  TYPE any.

  IF s_range IS INITIAL.
    WRITE: / w_label, AT 30 'NONE'.
    RETURN.
  ENDIF.

  w_firstLine = abap_true.
  SORT s_range BY ('SIGN') DESCENDING.
  LOOP AT s_range ASSIGNING <w_range>.
    ASSIGN COMPONENT 'SIGN' OF STRUCTURE <w_range> TO <w_sign>.
    ASSIGN COMPONENT 'LOW'  OF STRUCTURE <w_range> TO <w_low>.
    ASSIGN COMPONENT 'HIGH' OF STRUCTURE <w_range> TO <w_high>.

    IF w_firstLine = abap_true.
      WRITE: / w_label.
      WRITE AT 30 <w_low>.
      w_firstLine = abap_false.
    ELSE.
      NEW-LINE.
      WRITE AT 30 <w_low>.
    ENDIF.

    IF <w_high> IS NOT INITIAL.
      WRITE: ' to ', <w_high>.
    ENDIF.
    IF <w_sign> = 'E'.
      WRITE: ' (Exclude)'.
    ENDIF.
  ENDLOOP.
ENDFORM.