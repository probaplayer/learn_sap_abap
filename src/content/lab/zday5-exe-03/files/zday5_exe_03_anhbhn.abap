*&---------------------------------------------------------------------*
*& Report ZDAY5_EXE_03_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday5_exe_03_anhbhn.

TYPES: BEGIN OF ST_Employee,
         id      TYPE n LENGTH 10,
         Name    TYPE c LENGTH 20,
         Address TYPE c LENGTH 60,
         Email   TYPE c LENGTH 30,
         Depart  TYPE c LENGTH 4,
       END OF ST_Employee.

TYPES: TT_Employees TYPE HASHED TABLE OF ST_Employee
                      WITH UNIQUE KEY id.

DATA: WA_employee_standard TYPE STANDARD TABLE OF ST_Employee,
      WA_employees TYPE TT_Employees WITH HEADER LINE.


*DATA(WA_employees) = VALUE TT_employees(
*    ( id = '0000000001' name = 'Nguyen Van A'   address = '123 Le Loi, Q1, HCM'      email = 'a.nguyen@company.com'   depart = 'IT01' )
*    ( id = '0000000002' name = 'Tran Thi B'     address = '456 Nguyen Hue, Q1, HCM'  email = 'b.tran@company.com'     depart = 'HR01' )
*    ( id = '0000000003' name = 'Le Van C'       address = '789 Vo Van Tan, Q3, HCM'  email = 'c.le@company.com'       depart = 'FIN1' )
*    ( id = '0000000004' name = 'Pham Thi D'     address = '12 Hai Ba Trung, Q1, HCM' email = 'd.pham@company.com'     depart = 'IT01' )
*    ( id = '0000000005' name = 'Hoang Van E'    address = '34 Ly Tu Trong, Q1, HCM'  email = 'e.hoang@company.com'    depart = 'SALE' )
*    ( id = '0000000006' name = 'Vu Thi F'       address = '56 Pasteur, Q3, HCM'      email = 'f.vu@company.com'       depart = 'HR01' )
*    ( id = '0000000007' name = 'Dang Van G'     address = '78 Dien Bien Phu, Q3, HCM' email = 'g.dang@company.com'    depart = 'IT01' )
*    ( id = '0000000008' name = 'Bui Thi H'      address = '90 Cach Mang Thang 8'     email = 'h.bui@company.com'      depart = 'FIN1' )
*    ( id = '0000000009' name = 'Do Van I'       address = '11 Nam Ky Khoi Nghia'     email = 'i.do@company.com'       depart = 'SALE' )
*    ( id = '0000000010' name = 'Ngo Thi K'      address = '22 Ba Thang Hai, Q10'     email = 'k.ngo@company.com'      depart = 'IT01' )
*  ).

INITIALIZATION.
  WA_employees[] = VALUE TT_employees(
      ( id = '0000000001' name = 'Nguyen Van A'   address = '123 Le Loi, Q1, HCM'      email = 'a.nguyen@company.com'   depart = 'IT01' )
      ( id = '0000000002' name = 'Tran Thi B'     address = '456 Nguyen Hue, Q1, HCM'  email = 'b.tran@company.com'     depart = 'HR01' )
      ( id = '0000000003' name = 'Le Van C'       address = '789 Vo Van Tan, Q3, HCM'  email = 'c.le@company.com'       depart = 'FIN1' )
      ( id = '0000000004' name = 'Pham Thi D'     address = '12 Hai Ba Trung, Q1, HCM' email = 'd.pham@company.com'     depart = 'IT01' )
      ( id = '0000000005' name = 'Hoang Van E'    address = '34 Ly Tu Trong, Q1, HCM'  email = 'e.hoang@company.com'    depart = 'SALE' )
      ( id = '0000000006' name = 'Vu Thi F'       address = '56 Pasteur, Q3, HCM'      email = 'f.vu@company.com'       depart = 'HR01' )
      ( id = '0000000007' name = 'Dang Van G'     address = '78 Dien Bien Phu, Q3, HCM' email = 'g.dang@company.com'    depart = 'IT07' )
      ( id = '0000000008' name = 'Bui Thi H'      address = '90 Cach Mang Thang 8'     email = 'h.bui@company.com'      depart = 'FIN1' )
      ( id = '0000000009' name = 'Do Van I'       address = '11 Nam Ky Khoi Nghia'     email = 'i.do@company.com'       depart = 'SALE' )
      ( id = '0000000010' name = 'Ngo Thi K'      address = '22 Ba Thang Hai, Q10'     email = 'k.ngo@company.com'      depart = 'IT09' )
    ).

  LOOP AT WA_employees INTO DATA(WA_emp).
    APPEND WA_emp TO WA_employee_standard.
  ENDLOOP.

  SELECTION-SCREEN BEGIN OF BLOCK inpt_search
    WITH FRAME TITLE TEXT-000.
    SELECT-OPTIONS S_Id FOR WA_employees-id.

    PARAMETERS: P_Name   TYPE c LENGTH 20,
                P_Addr   TYPE c LENGTH 60,
                P_Email  TYPE c LENGTH 30.

    SELECT-OPTIONS S_Dep FOR WA_employees-depart.

  SELECTION-SCREEN END OF BLOCK inpt_search.

  SELECTION-SCREEN BEGIN OF BLOCK list_employee
    WITH FRAME TITLE TEXT-001.

*  CALL FUNCTION 'SRTT_TABLE_DISPLAY'
*    EXPORTING
*      table         = TT_Employees
*      iv_title      = 'User List'
*    TABLES
*      table_content = WA_employee_standard.

  SELECTION-SCREEN END OF BLOCK list_employee.

START-OF-SELECTION.
  PERFORM Build_employees_in_report
    USING WA_employees[] S_ID[] P_Name P_Addr P_Email S_Dep[].


FORM Build_employees_in_report
  USING WA_Employees TYPE TT_Employees
        S_Id         TYPE ANY TABLE
        P_Name       TYPE ST_Employee-Name
        P_Addr       TYPE ST_Employee-Address
        P_Email      TYPE ST_Employee-Email
        S_Dep     TYPE ANY TABLE.

  DATA wa_result TYPE TABLE OF st_employee.
  DATA wa_alv    TYPE REF TO cl_salv_table.

*  LOOP AT WA_Employees INTO DATA(WA_Employee).
*    IF ( P_Id     IS NOT INITIAL AND WA_Employee-id     <> P_Id )
*    OR ( P_Name   IS NOT INITIAL AND WA_Employee-name   NS P_Name )
*    OR ( P_Addr   IS NOT INITIAL AND WA_Employee-address NS P_Addr )
*    OR ( P_Email  IS NOT INITIAL AND WA_Employee-email  NS P_Email )
*    OR ( P_Depart IS NOT INITIAL AND WA_Employee-depart <> P_Depart ).
*      CONTINUE.
*    ENDIF.
*    APPEND WA_Employee TO wa_result.
*  ENDLOOP.

  DATA(W_name_pattern)   = |%{ P_Name }%|.
  DATA(W_addr_pattern)   = |%{ P_Addr }%|.
  DATA(W_email_pattern)  = |%{ P_Email }%|.

  SELECT *
    FROM @WA_Employees AS emp
    WHERE emp~id IN @S_Id
      AND ( @P_Name   = '' OR emp~name    LIKE @W_name_pattern )
      AND ( @P_Addr   = '' OR emp~address LIKE @W_addr_pattern )
      AND ( @P_Email  = '' OR emp~email   LIKE @W_email_pattern )
      AND emp~depart IN @S_Dep
    ORDER BY emp~depart
    INTO TABLE @wa_result.

  IF wa_result IS INITIAL.
    WRITE: / 'Not Found.'.
  ELSE.

    TRY.
        cl_salv_table=>factory(
          IMPORTING r_salv_table = wa_alv
          CHANGING  t_table      = wa_result ).
      CATCH cx_salv_msg INTO DATA(lx_msg).
        MESSAGE lx_msg->get_text( ) TYPE 'I' DISPLAY LIKE 'E'.
        RETURN.
    ENDTRY.

    DATA(lo_display) = wa_alv->get_display_settings( ).
    lo_display->set_list_header(
      |Danh sach nhan vien ({ lines( wa_result ) } ket qua)| ).

    DATA(lo_columns) = wa_alv->get_columns( ).
    lo_columns->set_optimize( abap_true ).

    TRY.
        DATA(lo_col_id) = lo_columns->get_column( 'ID' ).
        lo_col_id->set_short_text( 'Id' ).
        lo_col_id->set_medium_text( 'Id' ).
        lo_col_id->set_long_text( 'ID' ).

        DATA(lo_col_name) = lo_columns->get_column( 'NAME' ).
        lo_col_name->set_short_text( 'Name' ).
        lo_col_name->set_medium_text( 'Name' ).
        lo_col_name->set_long_text( 'Name' ).

        DATA(lo_col_addr) = lo_columns->get_column( 'ADDRESS' ).
        lo_col_addr->set_short_text( 'Address' ).
        lo_col_addr->set_medium_text( 'Address' ).
        lo_col_addr->set_long_text( 'Address' ).

        DATA(lo_col_email) = lo_columns->get_column( 'EMAIL' ).
        lo_col_email->set_short_text( 'Email' ).
        lo_col_email->set_medium_text( 'Email' ).
        lo_col_email->set_long_text( 'Email' ).

        DATA(lo_col_depart) = lo_columns->get_column( 'DEPART' ).
        lo_col_depart->set_short_text( 'Deparment' ).
        lo_col_depart->set_medium_text( 'Department' ).
        lo_col_depart->set_long_text( 'Department' ).

      CATCH cx_salv_not_found INTO DATA(lx_not_found).
        MESSAGE lx_not_found->get_text( ) TYPE 'I'.
      CATCH cx_salv_data_error INTO DATA(lx_data_error).
        MESSAGE lx_data_error->get_text( ) TYPE 'I'.
    ENDTRY.

    wa_alv->display( ).
  ENDIF.
ENDFORM.