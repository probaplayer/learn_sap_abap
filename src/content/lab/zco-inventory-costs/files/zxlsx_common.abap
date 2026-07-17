*&---------------------------------------------------------------------*
*& Include          ZXLSX_COMMON
*&---------------------------------------------------------------------*


TYPES: BEGIN OF st_xlsx_header,
         key   TYPE string,
         value TYPE string,
       END OF st_xlsx_header.
TYPES: tt_xlsx_header TYPE TABLE OF st_xlsx_header WITH EMPTY KEY.


FORM xlsx_col_letter USING iv_col TYPE i
                   CHANGING cv_letter TYPE string.

  DATA: lv_n TYPE i,
        lv_r TYPE i.

  CLEAR cv_letter.
  lv_n = iv_col.

  WHILE lv_n > 0.
    lv_r      = ( lv_n - 1 ) MOD 26.
    cv_letter = |{ sy-abcde+lv_r(1) }{ cv_letter }|.
    lv_n      = ( lv_n - 1 ) DIV 26.
  ENDWHILE.

ENDFORM.

FORM xlsx_sanitize_text CHANGING cv_text TYPE string.
  cv_text = replace( val = cv_text regex = `[\x00-\x08\x0B\x0C\x0E-\x1F]` with = `` occ = 0 ).
  REPLACE ALL OCCURRENCES OF '&' IN cv_text WITH '&amp;'.
  REPLACE ALL OCCURRENCES OF '<' IN cv_text WITH '&lt;'.
  REPLACE ALL OCCURRENCES OF '>' IN cv_text WITH '&gt;'.
  REPLACE ALL OCCURRENCES OF '"' IN cv_text WITH '&quot;'.
  REPLACE ALL OCCURRENCES OF '''' IN cv_text WITH '&apos;'.
ENDFORM.


*&---------------------------------------------------------------------*
*& Build header row (dòng 1) từ bảng dictionary key/value
*&---------------------------------------------------------------------*
FORM xlsx_build_header USING it_header TYPE tt_xlsx_header
                     CHANGING cv_row    TYPE string.

  DATA: lv_cells  TYPE string,
        lv_col    TYPE i VALUE 1,
        lv_letter TYPE string,
        lv_ref    TYPE string,
        lv_text   TYPE string.

  LOOP AT it_header INTO DATA(ls_h).

    PERFORM xlsx_col_letter USING lv_col CHANGING lv_letter.
    lv_ref  = |{ lv_letter }1|.

    lv_text = ls_h-value.
    PERFORM xlsx_sanitize_text CHANGING lv_text.

    lv_cells = |{ lv_cells }<c r="{ lv_ref }" t="inlineStr"><is><t>{ lv_text }</t></is></c>|.
    lv_col   = lv_col + 1.

  ENDLOOP.

  cv_row = |<row r="1">{ lv_cells }</row>|.

ENDFORM.


*&---------------------------------------------------------------------*
*& Build 1 dòng dữ liệu - GENERIC cho bất kỳ struct nào,
*& dựa vào it_header-key để đọc field động qua ASSIGN COMPONENT + RTTI
*&---------------------------------------------------------------------*
FORM xlsx_build_data_row USING is_data   TYPE any
                               it_header TYPE tt_xlsx_header
                               iv_row    TYPE i
                      CHANGING cv_row    TYPE string.

  DATA: lv_cells  TYPE string,
        lv_col    TYPE i VALUE 1,
        lv_letter TYPE string,
        lv_ref    TYPE string,
        lv_text   TYPE string,
        lv_num    TYPE p LENGTH 16 DECIMALS 4,
        lv_is_num TYPE abap_bool.

  FIELD-SYMBOLS: <fs_value> TYPE any.

  LOOP AT it_header INTO DATA(ls_h).

    PERFORM xlsx_col_letter USING lv_col CHANGING lv_letter.
    lv_ref = |{ lv_letter }{ iv_row }|.

    ASSIGN COMPONENT ls_h-key OF STRUCTURE is_data TO <fs_value>.

    IF sy-subrc = 0.

      DATA(lo_type) = cl_abap_typedescr=>describe_by_data( <fs_value> ).
      PERFORM xlsx_is_numeric USING lo_type->type_kind CHANGING lv_is_num.

      IF lv_is_num = abap_true.
        " ---- Cell dạng số: move sang biến kiểu P tường minh rồi mới format ----
        CLEAR lv_num.
        lv_num  = <fs_value>.
        lv_text = |{ lv_num NUMBER = RAW }|.
        lv_cells = |{ lv_cells }<c r="{ lv_ref }"><v>{ lv_text }</v></c>|.
      ELSE.
        " ---- Cell dạng text: MOVE thô (không dùng string template) để tránh
        "      ABAP tự áp dụng conversion exit - ví dụ bỏ số 0 đầu của MATNR
        "      hoặc đổi ngày DATS sang định dạng ISO ngoài ý muốn ----
        lv_text = <fs_value>.
        PERFORM xlsx_sanitize_text CHANGING lv_text.
        lv_cells = |{ lv_cells }<c r="{ lv_ref }" t="inlineStr"><is><t>{ lv_text }</t></is></c>|.
      ENDIF.

    ELSE.
      " ---- Key trong header không khớp field nào của struct: giữ ô trống thay vì bỏ hẳn <c> ----
      lv_cells = |{ lv_cells }<c r="{ lv_ref }" t="inlineStr"><is><t></t></is></c>|.
    ENDIF.

    lv_col = lv_col + 1.

  ENDLOOP.

  cv_row = |<row r="{ iv_row }">{ lv_cells }</row>|.

ENDFORM.


*&---------------------------------------------------------------------*
*& Xác định 1 type_kind (RTTI) có phải kiểu số hay không - dùng hằng số
*& cl_abap_typedescr thay vì chuỗi ký tự "magic" để dễ đọc & mở rộng
*&---------------------------------------------------------------------*
FORM xlsx_is_numeric USING iv_type_kind TYPE abap_typekind
                   CHANGING cv_is_num   TYPE abap_bool.

  cv_is_num = abap_false.

  CASE iv_type_kind.
    WHEN cl_abap_typedescr=>typekind_packed
      OR cl_abap_typedescr=>typekind_int
      OR cl_abap_typedescr=>typekind_int1
      OR cl_abap_typedescr=>typekind_int2
      OR cl_abap_typedescr=>typekind_int8
      OR cl_abap_typedescr=>typekind_float
      OR cl_abap_typedescr=>typekind_decfloat16
      OR cl_abap_typedescr=>typekind_decfloat34.
      cv_is_num = abap_true.
  ENDCASE.

ENDFORM.


*&---------------------------------------------------------------------*
*& Sinh toàn bộ file xlsx (xstring) từ BẤT KỲ bảng nào + header dictionary
*&---------------------------------------------------------------------*
FORM xlsx_generate USING    it_data      TYPE ANY TABLE
                             it_header    TYPE tt_xlsx_header
                             iv_sheetname TYPE string
                    CHANGING cv_xlsx_xstr TYPE xstring.

  DATA: lv_sheet_rows    TYPE string,
        lv_row           TYPE string,
        lv_row_num       TYPE i VALUE 2,
        lv_content_types TYPE string,
        lv_rels          TYPE string,
        lv_workbook      TYPE string,
        lv_wb_rels       TYPE string,
        lv_sheet_xml     TYPE string,
        lv_sheetname_esc TYPE string,
        lo_zip           TYPE REF TO cl_abap_zip,
        lv_sheetname     TYPE string
        .

  lv_sheetname = COND #( WHEN iv_sheetname = '' THEN 'sheet1' ELSE iv_sheetname ).

  FIELD-SYMBOLS: <fs_row> TYPE any.

  " ---- Header ----
  PERFORM xlsx_build_header USING it_header CHANGING lv_row.
  lv_sheet_rows = lv_row.

  " ---- Data rows ----
  LOOP AT it_data ASSIGNING <fs_row>.
    PERFORM xlsx_build_data_row USING <fs_row> it_header lv_row_num
                              CHANGING lv_row.
    lv_sheet_rows = |{ lv_sheet_rows }{ lv_row }|.
    lv_row_num    = lv_row_num + 1.
  ENDLOOP.

  " ---- Sheet name cũng cần escape (tránh ký tự đặc biệt trong tên sheet) ----
  lv_sheetname_esc = lv_sheetname.
  PERFORM xlsx_sanitize_text CHANGING lv_sheetname_esc.

  lv_content_types =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">| &&
    |<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>| &&
    |<Default Extension="xml" ContentType="application/xml"/>| &&
    |<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>| &&
    |<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>| &&
    |</Types>|.

  lv_rels =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">| &&
    |<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>| &&
    |</Relationships>|.

  lv_workbook =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">| &&
    |<sheets><sheet name="{ lv_sheetname_esc }" sheetId="1" r:id="rId1"/></sheets>| &&
    |</workbook>|.

  lv_wb_rels =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">| &&
    |<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>| &&
    |</Relationships>|.

  lv_sheet_xml =
    |<?xml version="1.0" encoding="UTF-8" standalone="yes"?>| &&
    |<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">| &&
    |<sheetData>{ lv_sheet_rows }</sheetData>| &&
    |</worksheet>|.

  CREATE OBJECT lo_zip.
  lo_zip->add( name = '[Content_Types].xml'       content = cl_abap_codepage=>convert_to( lv_content_types ) ).
  lo_zip->add( name = '_rels/.rels'                content = cl_abap_codepage=>convert_to( lv_rels ) ).
  lo_zip->add( name = 'xl/workbook.xml'            content = cl_abap_codepage=>convert_to( lv_workbook ) ).
  lo_zip->add( name = 'xl/_rels/workbook.xml.rels' content = cl_abap_codepage=>convert_to( lv_wb_rels ) ).
  lo_zip->add( name = 'xl/worksheets/sheet1.xml'   content = cl_abap_codepage=>convert_to( lv_sheet_xml ) ).

  cv_xlsx_xstr = lo_zip->save( ).

ENDFORM.


*&---------------------------------------------------------------------*
*& Download xstring ra file - local (GUI) hoặc server (Application Server)
*&---------------------------------------------------------------------*
FORM xlsx_download USING iv_xlsx_xstr TYPE xstring
                          iv_filename  TYPE string
                          iv_local     TYPE abap_bool.

  DATA: lt_bin      TYPE STANDARD TABLE OF sdokcntbin,
        lv_bin_size TYPE i.

  CALL FUNCTION 'SCMS_XSTRING_TO_BINARY'
    EXPORTING
      buffer        = iv_xlsx_xstr
    IMPORTING
      output_length = lv_bin_size
    TABLES
      binary_tab    = lt_bin.

  IF iv_local = abap_true.

    cl_gui_frontend_services=>gui_download(
      EXPORTING
        bin_filesize = lv_bin_size
        filename     = iv_filename
        filetype     = 'BIN'
      CHANGING
        data_tab     = lt_bin
      EXCEPTIONS
        OTHERS       = 1 ).

    IF sy-subrc <> 0.
      MESSAGE 'Error download file local' TYPE 'E'.
    ELSE.
      MESSAGE 'Download file success' TYPE 'S'.
    ENDIF.

  ELSE.

    OPEN DATASET iv_filename FOR OUTPUT IN BINARY MODE.
    IF sy-subrc <> 0.
      MESSAGE 'Can open file on server' TYPE 'E'.
      RETURN.
    ENDIF.

    LOOP AT lt_bin INTO DATA(ls_bin).
      TRANSFER ls_bin-line TO iv_filename.
    ENDLOOP.

    CLOSE DATASET iv_filename.
    MESSAGE 'Download file success' TYPE 'S'.

  ENDIF.

ENDFORM.