*&---------------------------------------------------------------------*
*& Report ZDAY8_EXE_02_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday8_exe_02_anhbhn.

DATA: w_check_exist TYPE abap_bool.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-000.
  PARAMETERS: p_arrid  TYPE sflight-carrid OBLIGATORY,
              p_connid TYPE sflight-connid OBLIGATORY,
              p_fldate TYPE sflight-fldate OBLIGATORY,
              p_price  TYPE sflight-price,
              p_curr   TYPE sflight-currency,
              p_plt    TYPE sflight-planetype,
              p_sm     TYPE sflight-seatsmax,
              p_ss     TYPE sflight-seatsocc,
              p_ps     TYPE sflight-paymentsum,
              p_sm_b   TYPE sflight-seatsmax_b,
              p_ss_b   TYPE sflight-seatsocc_b,
              p_sm_f   TYPE sflight-seatsmax_f,
              p_ss_f   TYPE sflight-seatsocc_f.

  SELECTION-SCREEN BEGIN OF LINE.
    SELECTION-SCREEN PUSHBUTTON 50(20) TEXT-001 USER-COMMAND btn_get.
  SELECTION-SCREEN END OF LINE.
SELECTION-SCREEN END OF BLOCK b1.

SELECTION-SCREEN BEGIN OF BLOCK b2 WITH FRAME TITLE TEXT-003.
  PARAMETERS p_scope TYPE c LENGTH 1 DEFAULT '1'.
  PARAMETERS p_mode TYPE c LENGTH 1 AS LISTBOX VISIBLE LENGTH 20 DEFAULT 'E'.
SELECTION-SCREEN END OF BLOCK b2.

INITIALIZATION.
  DATA: lt_list TYPE vrm_values,
        wa_list LIKE LINE OF lt_list.

  wa_list-key = 'E'. wa_list-text = 'Exclusive'.   APPEND wa_list TO lt_list.
  wa_list-key = 'S'. wa_list-text = 'Shared'.      APPEND wa_list TO lt_list.
  wa_list-key = 'X'. wa_list-text = 'Excl. no cum'. APPEND wa_list TO lt_list.
  wa_list-key = 'O'. wa_list-text = 'Optimistic'.  APPEND wa_list TO lt_list.

  CALL FUNCTION 'VRM_SET_VALUES'
    EXPORTING
      id     = 'P_MODE'
      values = lt_list.

AT SELECTION-SCREEN.
  CASE sy-ucomm.
    WHEN 'BTN_GET'.
      PERFORM get_record.
  ENDCASE.

  IF p_scope CN '123'.
    MESSAGE 'Scope allow 1, 2 or 3' TYPE 'E'.
  ENDIF.

  IF p_mode CN 'ESXO'.
    MESSAGE 'Mode allow E, S, X or O' TYPE 'E'.
  ENDIF.


START-OF-SELECTION.
  PERFORM check_exist.

  IF w_check_exist = abap_true.
    PERFORM on_update.
  ELSE.
    PERFORM on_insert.
  ENDIF.


FORM get_record.

  SELECT SINGLE
    price, currency, planetype, seatsmax, seatsocc,
    paymentsum, seatsmax_b, seatsocc_b, seatsmax_f, seatsocc_f
  FROM sflight
  WHERE carrid  = @p_arrid
    AND connid  = @p_connid
    AND fldate  = @p_fldate
  INTO ( @p_price, @p_curr, @p_plt, @p_sm, @p_ss,
         @p_ps, @p_sm_b, @p_ss_b, @p_sm_f, @p_ss_f ).

  IF sy-subrc = 0.
    MESSAGE 'Get data success' TYPE 'I'.
  ELSE.
    MESSAGE 'Record not found' TYPE 'I'.
  ENDIF.

ENDFORM.


FORM check_exist.

  SELECT SINGLE @abap_true
    FROM sflight
    WHERE carrid = @p_arrid
      AND connid = @p_connid
      AND fldate = @p_fldate
    INTO @w_check_exist.

  IF sy-subrc <> 0.
    w_check_exist = abap_false.
  ENDIF.

ENDFORM.


FORM on_insert.

  DATA wa_sflight TYPE sflight.

  wa_sflight-carrid     = p_arrid.
  wa_sflight-connid     = p_connid.
  wa_sflight-fldate     = p_fldate.
  wa_sflight-price      = p_price.
  wa_sflight-currency   = p_curr.
  wa_sflight-planetype  = p_plt.
  wa_sflight-seatsmax   = p_sm.
  wa_sflight-seatsocc   = p_ss.
  wa_sflight-paymentsum = p_ps.
  wa_sflight-seatsmax_b = p_sm_b.
  wa_sflight-seatsocc_b = p_ss_b.
  wa_sflight-seatsmax_f = p_sm_f.
  wa_sflight-seatsocc_f = p_ss_f.

  INSERT sflight FROM wa_sflight.

  IF sy-subrc = 0.
    COMMIT WORK AND WAIT.
    MESSAGE 'Insert success' TYPE 'S'.
  ELSE.
    MESSAGE 'Insert failed' TYPE 'E'.
  ENDIF.

ENDFORM.


FORM on_update.


  CALL FUNCTION 'ENQUEUE_ESFLIGHT'
    EXPORTING
      mandt          = sy-mandt
      carrid         = p_arrid
      connid         = p_connid
      fldate         = p_fldate
      _scope         = p_scope
    EXCEPTIONS
      foreign_lock   = 1
      system_failure = 2
      OTHERS         = 3.

  IF sy-subrc <> 0.
    MESSAGE 'Record in other progress' TYPE 'E'.
    RETURN.
  ENDIF.

  UPDATE sflight SET
    price      = p_price
    currency   = p_curr
    planetype  = p_plt
    seatsmax   = p_sm
    seatsocc   = p_ss
    paymentsum = p_ps
    seatsmax_b = p_sm_b
    seatsocc_b = p_ss_b
    seatsmax_f = p_sm_f
    seatsocc_f = p_ss_f
  WHERE carrid = p_arrid
    AND connid = p_connid
    AND fldate = p_fldate.

  IF sy-subrc = 0.
    COMMIT WORK AND WAIT.
    MESSAGE 'Update success' TYPE 'S'.
  ELSE.
    MESSAGE 'Update failed' TYPE 'E'.
  ENDIF.


  CALL FUNCTION 'DEQUEUE_ESFLIGHT'
    EXPORTING
      mode_sflight = p_mode
      mandt  = sy-mandt
      carrid = p_arrid
      connid = p_connid
      fldate = p_fldate
      .

ENDFORM.