*&---------------------------------------------------------------------*
*& Report ZDAY6_EXE_01_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday6_exe_01_anhbhn.

DATA: wa_customers TYPE TABLE OF ztrain_customer,
      wa_customer  TYPE ztrain_customer,
      wa_materials TYPE TABLE OF ztrain_material,
      wa_material  TYPE ztrain_material,
      wa_dochds    TYPE TABLE OF ztrain_dochd,
      wa_dochd     TYPE ztrain_dochd,
      wa_docdts    TYPE TABLE OF ztrain_docdt,
      wa_docdt     TYPE ztrain_docdt.


TYPES: BEGIN OF st_item,
         cust_id    TYPE ztrain_customer-custid,
         cust_name  TYPE ztrain_customer-name,
         doc_id     TYPE ztrain_dochd-docid,
         mat_id     TYPE ztrain_material-invtid,
         mat_name   TYPE ztrain_material-name,
         doc_qty    TYPE ztrain_docdt-qty,
         mat_unit   TYPE ztrain_material-unit,
         doc_amount TYPE ztrain_docdt-amont,
         doc_date   TYPE ztrain_dochd-docda,
         doc_status TYPE ztrain_dochd-statu,
       END OF st_item.

DATA: wa_items TYPE TABLE OF st_item,
      wa_item  TYPE st_item
      .

DATA w_b_upload TYPE abap_bool.

SELECTION-SCREEN BEGIN OF BLOCK action
  WITH FRAME TITLE TEXT-000.

  SELECTION-SCREEN BEGIN OF LINE.
    SELECTION-SCREEN POSITION 28.
    PARAMETERS: p_up RADIOBUTTON GROUP gact DEFAULT 'X' USER-COMMAND ucomm.
    SELECTION-SCREEN COMMENT (10) FOR FIELD p_up.
    PARAMETERS: p_down RADIOBUTTON GROUP gact.
    SELECTION-SCREEN COMMENT (10) FOR FIELD p_down.
  SELECTION-SCREEN END OF LINE.
  PARAMETERS: p_path TYPE localfile.

SELECTION-SCREEN END OF BLOCK action.


SELECTION-SCREEN BEGIN OF BLOCK inpt_cus
  WITH FRAME TITLE TEXT-001.

  SELECT-OPTIONS s_cus FOR wa_customer-custid MODIF ID cus.
  PARAMETERS p_type LIKE wa_customer-type MODIF ID cus.

SELECTION-SCREEN END OF BLOCK inpt_cus.

SELECTION-SCREEN BEGIN OF BLOCK others
  WITH FRAME TITLE TEXT-002.

  SELECT-OPTIONS s_date FOR wa_dochd-docda MODIF ID doc.
  PARAMETERS p_status LIKE wa_dochd-statu MODIF ID doc.

SELECTION-SCREEN END OF BLOCK others.

AT SELECTION-SCREEN ON VALUE-REQUEST FOR p_path.
  CALL FUNCTION 'F4_FILENAME'
    EXPORTING
      program_name  = syst-cprog
      dynpro_number = syst-dynnr
      field_name    = ' '
    IMPORTING
      file_name     = p_path.


AT SELECTION-SCREEN ON p_path.
  " Trigger AT SELECTION-SCREEN OUTPUT chạy lại
  LOOP AT SCREEN.
    IF screen-group1 = 'CUS'.
      IF p_up = 'X'.
        screen-active = 0.
      ELSE.
        screen-active = 1.
      ENDIF.
      MODIFY SCREEN.
    ENDIF.
    IF screen-group1 = 'DOC'.
      IF p_up = 'X'.
        screen-active = 0.
      ELSE.
        screen-active = 1.
      ENDIF.
      MODIFY SCREEN.
    ENDIF.
  ENDLOOP.

AT SELECTION-SCREEN OUTPUT.
  LOOP AT SCREEN.
    IF screen-group1 = 'CUS'.
      IF p_up = 'X'.
        screen-active = 0.
      ELSE.
        screen-active = 1.
      ENDIF.
      MODIFY SCREEN.
    ENDIF.

    IF screen-group1 = 'DOC'.
      IF p_up = 'X'.
        screen-active = 0.
      ELSE.
        screen-active = 1.
      ENDIF.
      MODIFY SCREEN.
    ENDIF.
  ENDLOOP.

START-OF-SELECTION.
  IF strlen( p_path ) = 0.
    EXIT.
  ENDIF.
  IF p_up = 'X'.
    PERFORM on_upload.
  ELSEIF p_down = 'X'.
    PERFORM on_download.
  ENDIF.

AT LINE-SELECTION.
  DATA: wa_details_list LIKE wa_items.
  IF wa_item-cust_id IS NOT INITIAL.
    CASE sy-lsind.
      WHEN 1.
        PERFORM show_detail_customer CHANGING wa_details_list.
      WHEN 2.
        TRY.
            PERFORM progress_download USING wa_details_list.
          CATCH cx_root INTO DATA(lx_error).
            MESSAGE lx_error->get_text( ) TYPE 'E'.
        ENDTRY.
    ENDCASE.
  ENDIF.

*Case: Download
FORM on_download.
  TRY.
      PERFORM search_on_condition.
    CATCH cx_root INTO DATA(lx_error).
      MESSAGE lx_error->get_text( ) TYPE 'E'.
  ENDTRY.
ENDFORM.

FORM progress_download USING wa_details_list LIKE wa_items.
  DATA: w_file_path TYPE string,
        wa_csv_rows TYPE TABLE OF string,
        w_csv_row   TYPE string.

  IF lines( wa_details_list ) = 0.
    MESSAGE 'No data to download' TYPE 'W'.
    RETURN.
  ENDIF.

  w_csv_row = 'Customer number,Document ID,Material ID,Material Name,Quantity,Unit,Amount,Document date,Status'.
  APPEND w_csv_row TO wa_csv_rows.

  LOOP AT wa_details_list INTO wa_item.
    DATA(w_date) = |{ wa_item-doc_date+4(2) }/{ wa_item-doc_date+6(2) }/{ wa_item-doc_date+0(4) }|.
    w_csv_row = |{ wa_item-cust_id },{ wa_item-doc_id },{ wa_item-mat_id },{ wa_item-mat_name },{ wa_item-doc_qty },{ wa_item-mat_unit },{ wa_item-doc_amount },{ w_date },{ wa_item-doc_status }|.
    APPEND w_csv_row TO wa_csv_rows.
  ENDLOOP.

  w_file_path = p_path.

  CALL FUNCTION 'GUI_DOWNLOAD'
    EXPORTING
      filename                = w_file_path
    TABLES
      data_tab                = wa_csv_rows
    EXCEPTIONS
      file_write_error        = 1
      no_batch                = 2
      gui_refuse_filetransfer = 3
      invalid_type            = 4
      no_authority            = 5
      unknown_error           = 6
      OTHERS                  = 22.

  IF sy-subrc = 0.
    MESSAGE |Downloaded { lines( wa_details_list ) } rows successfully| TYPE 'S'.
  ELSE.
    MESSAGE 'Download failed' TYPE 'E'.
  ENDIF.
ENDFORM.

FORM search_on_condition.
*  LOOP AT s_cus ASSIGNING FIELD-SYMBOL(<fs>).
*    IF <fs>-low IS NOT INITIAL.
*      <fs>-low = |{ <fs>-low ALPHA = IN }|.
*    ENDIF.
*    IF <fs>-high IS NOT INITIAL.
*      <fs>-high = |{ <fs>-high ALPHA = IN }|.
*    ENDIF.
*  ENDLOOP.

  SELECT c~custid,
         c~name,
         d~docid,
         m~invtid,
         m~name,
         SUM( dt~qty ),
         SUM( m~unit ),
         SUM( dt~amont ),
         d~docda,
         d~statu
    FROM ztrain_customer AS c
    LEFT JOIN ztrain_dochd  AS d  ON c~custid = d~custid
    LEFT JOIN ztrain_docdt  AS dt ON d~docid  = dt~docid
    LEFT JOIN ztrain_material AS m ON m~invtid = dt~invtid
    WHERE ( c~custid IN @s_cus  )
      AND d~docda IN @s_date
      AND ( @p_type = '' OR c~type  =  @p_type )
      AND ( @p_status = '' OR d~statu = @p_status )
    GROUP BY
      c~custid,
      c~name,
      d~docid,
      m~invtid,
      m~name,
      d~docda,
      d~statu
    ORDER BY
      c~custid
    INTO TABLE @wa_items.

  PERFORM show_searched_customers.

ENDFORM.


FORM show_searched_customers.
  DATA: wa_unique_customers LIKE wa_items.

  wa_unique_customers = wa_items.

  DELETE ADJACENT DUPLICATES FROM wa_unique_customers COMPARING cust_id.

  WRITE: 'Customer number', 30 'Customer name'.
  ULINE.
  LOOP AT wa_unique_customers INTO wa_item.
    WRITE: / wa_item-cust_id, 30 wa_item-cust_name.
    HIDE: wa_item-cust_id.
  ENDLOOP.
ENDFORM.

FORM show_detail_customer
  CHANGING wa_details_list LIKE wa_items.

  DATA: w_header TYPE string,
        w_line   TYPE string,
        w_amount_str TYPE string,
        w_unit_str TYPE string,
        w_total_amount TYPE ztrain_docdt-amont VALUE 0
        .
  CONSTANTS: w_w_docid  TYPE i VALUE 15,
             w_w_matid  TYPE i VALUE 15,
             w_w_name   TYPE i VALUE 25,
             w_w_qty    TYPE i VALUE 10,
             w_w_unit   TYPE i VALUE 10,
             w_w_amount TYPE i VALUE 20,
             w_w_date   TYPE i VALUE 20,
             w_w_status TYPE i VALUE 10.

  w_header = |{ 'Document ID' WIDTH = w_w_docid  }{ 'Material ID' WIDTH = w_w_matid  }{ 'Material Name' WIDTH = w_w_name   }{ 'Quantity' WIDTH = w_w_qty    }{ 'Unit' WIDTH = w_w_unit   }{ 'Amount' WIDTH = w_w_amount }{ 'Date' WIDTH = w_w_date   }{
'Status' WIDTH = w_w_status }|.

  CLEAR wa_details_list.

  LOOP AT wa_items INTO wa_item
    WHERE cust_id = wa_item-cust_id
      AND doc_id IS NOT INITIAL.
    APPEND wa_item TO wa_details_list.
  ENDLOOP.

  IF wa_details_list IS INITIAL.
    WRITE: / 'Customer ID:', wa_item-cust_id.
    WRITE: / 'Name: ', wa_item-cust_name.
    NEW-LINE.
    ULINE.
    WRITE: 30 w_header.
    ULINE.
    WRITE: 30 'No documents found.'.
  ELSE.
    WRITE: 'Customer ID:', wa_item-cust_id.
    NEW-LINE.
    WRITE: 'Name: ', wa_item-cust_name.
    NEW-LINE.
    ULINE.

    WRITE: 30 w_header.
    ULINE.

    LOOP AT wa_details_list INTO wa_item.
      DATA(w_formated_date) = |{ wa_item-doc_date+4(2) }/{ wa_item-doc_date+6(2) }/{ wa_item-doc_date+0(4) }|.

      w_amount_str = |{ wa_item-doc_amount }|.
      w_unit_str = |{ wa_item-mat_unit }|.
      PERFORM trim_zero_in_tail USING w_amount_str CHANGING w_amount_str.
      PERFORM trim_zero_in_tail USING w_unit_str CHANGING w_unit_str.

      w_line = |{ wa_item-doc_id     WIDTH = w_w_docid  }{ wa_item-mat_id     WIDTH = w_w_matid  }{ wa_item-mat_name   WIDTH = w_w_name   }{ wa_item-doc_qty    WIDTH = w_w_qty    }{ w_unit_str   WIDTH = w_w_unit   }{ w_amount_str WIDTH =
w_w_amount }{ w_formated_date   WIDTH = w_w_date   }{ wa_item-doc_status WIDTH = w_w_status }|.

      w_total_amount = w_total_amount + wa_item-doc_amount.

      NEW-LINE.
      HIDE wa_item.
      WRITE: 30 w_line.
    ENDLOOP.

*    w_total_amount = REDUCE ztrain_docdt-amont(
*                             INIT w_sum TYPE ztrain_docdt-amont
*                             FOR w_t_item IN wa_details_list
*                             NEXT w_sum = w_sum + w_t_item-doc_amount
*                           ).

    DATA(w_amount_pos) = 28 + w_w_docid + w_w_matid + w_w_name + w_w_qty + w_w_unit.
    DATA: w_total_amount_str  TYPE string.
    w_total_amount_str = |{ w_total_amount }|.
    PERFORM trim_zero_in_tail USING w_total_amount_str CHANGING w_total_amount_str.
    NEW-LINE.
    WRITE AT (w_amount_pos) 'Total:'.
    WRITE w_total_amount_str.

  ENDIF.

ENDFORM.

FORM trim_zero_in_tail USING w_dec_str TYPE string
                       CHANGING w_r_dec_str TYPE string.

  IF w_dec_str NS '.'.
    w_r_dec_str = w_dec_str.
    RETURN.
  ENDIF.

  DATA(w_len) = strlen( w_dec_str ).
  DATA(w_index) = w_len - 1.
  DATA(w_found) = abap_false.

  DO w_len TIMES.
    DATA(w_lt_char) = w_dec_str+w_index(1).
    IF w_lt_char = '0'.
      w_index = w_index - 1.
    ELSEIF w_lt_char = '.'.
      w_index = w_index - 1.
      w_found = abap_true.
      EXIT.
    ELSE.
      w_found = abap_true.
      EXIT.
    ENDIF.
  ENDDO.

  IF w_found = abap_false.
    w_r_dec_str = '0'.
  ELSE.
    DATA(w_l_index) = w_index + 1.
    w_r_dec_str = w_dec_str+0(w_l_index).
  ENDIF.

ENDFORM.

*Case: Upload
FORM on_upload.
  TRY.
      PERFORM load_data_from_file.
    CATCH cx_root INTO DATA(lx_error).
      MESSAGE lx_error->get_text( ) TYPE 'E'.
  ENDTRY.
ENDFORM.

FORM load_data_from_file.
  DATA: w_filepath TYPE string,
        wa_rows    TYPE TABLE OF string,
        w_row      TYPE string,
        w_fnumber  TYPE string,
        w_fname    TYPE ztrain_customer-name,
        w_faddr    TYPE ztrain_customer-addr,
        w_ftype    TYPE ztrain_customer-type,
        w_fblan    TYPE string,
        w_cuky     TYPE ztrain_customer-cuky
        .

  w_filepath = p_path.

  CALL FUNCTION 'GUI_UPLOAD'
    EXPORTING
      filename                = w_filepath
    TABLES
      data_tab                = wa_rows
    EXCEPTIONS
      file_open_error         = 1
      file_read_error         = 2
      no_batch                = 3
      gui_refuse_filetransfer = 4
      invalid_type            = 5
      no_authority            = 6
      unknown_error           = 7
      bad_data_format         = 8
      header_not_allowed      = 9
      separator_not_allowed   = 10
      header_too_long         = 11
      unknown_dp_error        = 12
      access_denied           = 13
      dp_out_of_memory        = 14
      disk_full               = 15
      dp_timeout              = 16
      OTHERS                  = 17.
  IF sy-subrc <> 0.
* Implement suitable error handling here
    MESSAGE 'Cannot read file' TYPE 'E'.
  ENDIF.

  CLEAR wa_customers.

  DELETE wa_rows INDEX 1.

  LOOP AT wa_rows INTO w_row.
    SPLIT w_row AT ',' INTO w_fnumber
                            w_fname
                            w_faddr
                            w_ftype
                            w_fblan
                            w_cuky.

    PERFORM pad_zero USING w_fnumber CHANGING wa_customer-custid.
*    wa_customer-custid = w_fnumber.
    wa_customer-name = w_fname.
    wa_customer-addr = w_faddr.
    wa_customer-type = w_ftype.
    wa_customer-baln = w_fblan.
    wa_customer-cuky = w_cuky.

    APPEND wa_customer TO wa_customers.
  ENDLOOP.

  PERFORM insert_customers.

ENDFORM.

FORM pad_zero USING w_input TYPE string
              CHANGING w_output TYPE ztrain_customer-custid.
  w_output = w_input.
  WHILE strlen( w_output ) < 10.
    w_output = '0' && w_output.
  ENDWHILE.
ENDFORM.

FORM insert_customers.
  MODIFY ztrain_customer FROM TABLE wa_customers.
  IF sy-subrc = 0.
    COMMIT WORK.
    MESSAGE 'Insert/Update customers successfully' TYPE 'S'.
    PERFORM show_inserted_customers.
  ELSE.
    ROLLBACK WORK.
    MESSAGE 'Insert/Update customers failed' TYPE 'E'.
  ENDIF.
ENDFORM.

FORM show_inserted_customers.
  WRITE: / 'Customer number', 20 'Customer name', 50 'Address', 70 'Type', 85 'Balance', 125 'Currency type'.
  ULINE.
  LOOP AT wa_customers INTO wa_customer.
    WRITE: / wa_customer-custid,
             20 wa_customer-name,
             50 wa_customer-addr,
             70 wa_customer-type,
             85 wa_customer-baln LEFT-JUSTIFIED,
             125 wa_customer-cuky.
  ENDLOOP.
ENDFORM.