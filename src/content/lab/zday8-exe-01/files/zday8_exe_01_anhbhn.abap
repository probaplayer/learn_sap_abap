*&---------------------------------------------------------------------*
*& Report ZDAY8_EXE_01_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday8_exe_01_anhbhn.

DATA: w_check  TYPE abap_bool,
      w_lineid TYPE ztrain_docdt-lineid.

DATA: wa_dochd TYPE ztrain_dochd,
      wa_docdt TYPE ztrain_docdt.

SELECTION-SCREEN BEGIN OF BLOCK b0 WITH FRAME TITLE TEXT-000.
  PARAMETERS p_docid TYPE ztrain_dochd-docid.
  PARAMETERS p_statu TYPE ztrain_dochd-statu.
  PARAMETERS p_qty   TYPE ztrain_docdt-qty.
  PARAMETERS p_amont TYPE ztrain_docdt-amont.

  SELECTION-SCREEN BEGIN OF LINE.
    SELECTION-SCREEN PUSHBUTTON 50(20) TEXT-001 USER-COMMAND btn_get.
  SELECTION-SCREEN END OF LINE.
SELECTION-SCREEN END OF BLOCK b0.


AT SELECTION-SCREEN ON p_docid.
  PERFORM check_exist USING abap_true.

AT SELECTION-SCREEN.
  CASE sy-ucomm.
    WHEN 'BTN_GET'.
      PERFORM get_record.
  ENDCASE.

START-OF-SELECTION.
  PERFORM modify_record.


FORM modify_record.

  TRY.
    IF w_check = abap_true.
      PERFORM on_update.
    ELSE.
*      PERFORM on_insert.
      MESSAGE 'Record not exist.' TYPE 'E'.
    ENDIF.
  CATCH cx_root INTO DATA(lx_error).
    MESSAGE lx_error->get_text( ) TYPE 'E'.
  ENDTRY.

ENDFORM.


FORM on_insert.

  wa_dochd-docid = p_docid.
  wa_dochd-statu = p_statu.

  wa_docdt-docid = p_docid.
  wa_docdt-qty   = p_qty.
  wa_docdt-amont = p_amont.
  wa_docdt-lineid = 1.

  INSERT ztrain_dochd FROM wa_dochd.
  IF sy-subrc <> 0.
    MESSAGE 'Insert header failed' TYPE 'E'.
  ENDIF.

  INSERT ztrain_docdt FROM wa_docdt.
  IF sy-subrc <> 0.
    MESSAGE 'Insert detail failed' TYPE 'E'.
  ENDIF.

  COMMIT WORK AND WAIT.

  MESSAGE 'Insert success' TYPE 'S'.

ENDFORM.


FORM on_update.

  CALL FUNCTION 'ENQUEUE_EZDOCHD_ANHBHN'
    EXPORTING
      docid          = p_docid
      lineid         = w_lineid
    EXCEPTIONS
      foreign_lock   = 1
      system_failure = 2
      OTHERS         = 3.

  IF sy-subrc <> 0.
    MESSAGE 'Record in progress update' TYPE 'E'.
    RETURN.
  ENDIF.

  UPDATE ztrain_dochd SET statu = p_statu WHERE docid = p_docid.
  UPDATE ztrain_docdt SET qty = p_qty amont = p_amont
    WHERE docid = p_docid AND lineid = w_lineid.

  COMMIT WORK AND WAIT.

  CALL FUNCTION 'DEQUEUE_EZDOCHD_ANHBHN'
    EXPORTING
      docid  = p_docid
      lineid = w_lineid.

  MESSAGE 'Update success' TYPE 'S'.

ENDFORM.


FORM get_record.
  SELECT SINGLE
    ztrain_dochd~statu,
    ztrain_docdt~qty,
    ztrain_docdt~amont
  FROM ztrain_dochd
  JOIN ztrain_docdt
    ON ztrain_dochd~docid = ztrain_docdt~docid
  WHERE ztrain_dochd~docid = @p_docid
  INTO (@p_statu , @p_qty, @p_amont).
ENDFORM.


FORM check_exist USING
      iv_hmsg TYPE abap_bool.

  CLEAR: w_lineid, w_check.

  SELECT SINGLE
      ztrain_docdt~lineid
    FROM ztrain_dochd
    JOIN ztrain_docdt
      ON ztrain_dochd~docid = ztrain_docdt~docid
    WHERE ztrain_dochd~docid = @p_docid
    INTO @w_lineid.

  IF sy-subrc = 0.
    w_check = abap_true.
  ELSE.
    w_check = abap_false.
  ENDIF.

  IF iv_hmsg = abap_true.
    IF w_check = abap_false.
      MESSAGE 'Record not exist.' TYPE 'E'.
    ENDIF.
  ENDIF.

ENDFORM.