REPORT zday11_bdc_fs00_mass_anhbhn.

PARAMETERS: p_file TYPE rlgrap-filename OBLIGATORY.

TYPES: BEGIN OF st_glaccount,
         saknr TYPE ska1-saknr,
         bukrs TYPE t001-bukrs,
         gltyp TYPE c LENGTH 1,
         ktoks TYPE ska1-ktoks,
         txt20 TYPE skat-txt20,
         txt50 TYPE skat-txt50,
         waers TYPE skb1-waers,
         fstag TYPE skb1-fstag,
       END OF st_glaccount.

TYPES: BEGIN OF st_result,
         saknr   TYPE ska1-saknr,
         status  TYPE c LENGTH 10,
         message TYPE string,
       END OF st_result.

DATA: it_glaccount TYPE TABLE OF st_glaccount,
      wa_glaccount TYPE st_glaccount,
      it_result    TYPE TABLE OF st_result,
      wa_result    TYPE st_result,
      it_raw       TYPE TABLE OF string,
      lv_line      TYPE string.

DATA: it_filetable TYPE filetable,
      wa_filetable TYPE file_table,
      lv_rc        TYPE i,
      w_filename  TYPE string.

DATA: it_bdcdata TYPE TABLE OF bdcdata,
      wa_bdcdata TYPE bdcdata,
      it_messtab TYPE TABLE OF bdcmsgcoll,
      wa_msg     TYPE bdcmsgcoll,
      wa_opt     TYPE ctu_params,
      lv_msgtext TYPE string,
      lv_check   TYPE ska1-saknr.


DEFINE bdc_dynpro.
  CLEAR wa_bdcdata.
  wa_bdcdata-program  = &1.
  wa_bdcdata-dynpro   = &2.
  wa_bdcdata-dynbegin = 'X'.
  APPEND wa_bdcdata TO it_bdcdata.
END-OF-DEFINITION.

DEFINE bdc_field.
  CLEAR wa_bdcdata.
  wa_bdcdata-fnam = &1.
  wa_bdcdata-fval = &2.
  APPEND wa_bdcdata TO it_bdcdata.
END-OF-DEFINITION.


AT SELECTION-SCREEN ON VALUE-REQUEST FOR p_file.
  CALL METHOD cl_gui_frontend_services=>file_open_dialog
    EXPORTING
      file_filter = 'CSV Files (*.csv)|*.csv|'
    CHANGING
      file_table  = it_filetable
      rc          = lv_rc.

  IF lines( it_filetable ) > 0.
    READ TABLE it_filetable INTO wa_filetable INDEX 1.
    p_file = wa_filetable-filename.
  ENDIF.

START-OF-SELECTION.

  w_filename = p_file.

  CALL METHOD cl_gui_frontend_services=>gui_upload
    EXPORTING
      filename = w_filename
      filetype = 'ASC'
    CHANGING
      data_tab = it_raw
    EXCEPTIONS
      OTHERS   = 1.

  IF sy-subrc <> 0.
    WRITE: / 'Could not read file:', p_file.
    RETURN.
  ENDIF.

  LOOP AT it_raw INTO lv_line FROM 2.
    CLEAR wa_glaccount.
    SPLIT lv_line AT ',' INTO
      wa_glaccount-saknr
      wa_glaccount-bukrs
      wa_glaccount-gltyp
      wa_glaccount-ktoks
      wa_glaccount-txt20
      wa_glaccount-txt50
      wa_glaccount-waers
      wa_glaccount-fstag.
    APPEND wa_glaccount TO it_glaccount.
  ENDLOOP.

  WRITE: / 'Read', lines( it_glaccount ), 'rows from CSV file.'.
  ULINE.

  LOOP AT it_glaccount INTO wa_glaccount.

    CLEAR: it_bdcdata, it_messtab, wa_result.

    SELECT SINGLE saknr FROM ska1
      INTO lv_check
      WHERE saknr = wa_glaccount-saknr.

    IF sy-subrc = 0.
      wa_result-saknr   = wa_glaccount-saknr.
      wa_result-status  = 'Error'.
      wa_result-message = 'Account already exists'.
      APPEND wa_result TO it_result.
      CONTINUE.
    ENDIF.

    bdc_dynpro 'SAPLGL_ACCOUNT_MASTER_MAINTAIN' '2001'.
    bdc_field  'BDC_OKCODE'                          '=ACC_CRE'.
    bdc_field  'BDC_CURSOR'                          'GLACCOUNT_SCREEN_KEY-SAKNR'.
    bdc_field  'GLACCOUNT_SCREEN_KEY-SAKNR'          wa_glaccount-saknr.
    bdc_field  'GLACCOUNT_SCREEN_KEY-BUKRS'          wa_glaccount-bukrs.

    bdc_dynpro 'SAPLGL_ACCOUNT_MASTER_MAINTAIN' '2001'.
    bdc_field  'BDC_OKCODE'                          '=GLACC_TYPE'.
    bdc_field  'BDC_CURSOR'                          'GLACCOUNT_SCREEN_COA-TXT50_ML'.
    bdc_field  'GLACCOUNT_SCREEN_COA-GLACCOUNT_TYPE' wa_glaccount-gltyp.
    bdc_field  'GLACCOUNT_SCREEN_COA-KTOKS'          wa_glaccount-ktoks.
    bdc_field  'GLACCOUNT_SCREEN_COA-TXT20_ML'       wa_glaccount-txt20.
    bdc_field  'GLACCOUNT_SCREEN_COA-TXT50_ML'       wa_glaccount-txt50.

    bdc_dynpro 'SAPLGL_ACCOUNT_MASTER_MAINTAIN' '2001'.
    bdc_field  'BDC_OKCODE'                          '=TAB03'.
    bdc_field  'BDC_CURSOR'                          'GLACCOUNT_SCREEN_CCODE-WAERS'.
    bdc_field  'GLACCOUNT_SCREEN_CCODE-WAERS'        wa_glaccount-waers.

    bdc_dynpro 'SAPLGL_ACCOUNT_MASTER_MAINTAIN' '2001'.
    bdc_field  'BDC_OKCODE'                          '=SAVE'.
    bdc_field  'BDC_CURSOR'                          'GLACCOUNT_SCREEN_CCODE-FSTAG'.
    bdc_field  'GLACCOUNT_SCREEN_CCODE-FSTAG'        wa_glaccount-fstag.

    wa_opt-dismode = 'N'.
    wa_opt-updmode = 'S'.

    CALL TRANSACTION 'FS00' USING it_bdcdata
                            OPTIONS FROM wa_opt
                            MESSAGES INTO it_messtab.

    wa_result-saknr = wa_glaccount-saknr.
    IF sy-subrc = 0.
      wa_result-status  = 'Success'.
      wa_result-message = 'Created successfully'.
    ELSE.
      wa_result-status = 'Error'.
      READ TABLE it_messtab INTO wa_msg INDEX 1.
      IF sy-subrc = 0.
        CLEAR lv_msgtext.
        MESSAGE ID wa_msg-msgid TYPE wa_msg-msgtyp NUMBER wa_msg-msgnr
          INTO lv_msgtext
          WITH wa_msg-msgv1 wa_msg-msgv2 wa_msg-msgv3 wa_msg-msgv4.
        wa_result-message = lv_msgtext.
      ELSE.
        wa_result-message = 'No message captured - check dismode/BDC screen flow'.
      ENDIF.
    ENDIF.
    APPEND wa_result TO it_result.

  ENDLOOP.


  WRITE: / 'G/L ACCOUNT CREATION RESULT'.
  ULINE.
  LOOP AT it_result INTO wa_result.
    WRITE: / wa_result-saknr, wa_result-status, wa_result-message.
  ENDLOOP.