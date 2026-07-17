*&---------------------------------------------------------------------*
*& Report ZDAY9_EXE_01_2_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT ZDAY9_EXE_01_2_ANHBHN.

DATA: lt_sflight  TYPE TABLE OF sflight,
      it_fieldcat TYPE slis_t_fieldcat_alv,
      x_fieldcat  TYPE slis_fieldcat_alv,
      x_layout    TYPE slis_layout_alv.

SELECT * FROM sflight
  INTO TABLE lt_sflight.

CALL FUNCTION 'REUSE_ALV_FIELDCATALOG_MERGE'
  EXPORTING
    i_structure_name = 'SFLIGHT'
  CHANGING
    ct_fieldcat      = it_fieldcat
  EXCEPTIONS
    inconsistent_interface = 1
    program_error          = 2
    OTHERS                 = 3.

LOOP AT it_fieldcat INTO x_fieldcat.
  CASE x_fieldcat-fieldname.
    WHEN 'SEATSMAX'.
      x_fieldcat-no_out  = 'X'.
    WHEN 'FLDATE'.
      x_fieldcat-col_pos = 1.
    WHEN 'CARRID'.
      x_fieldcat-col_pos = 2.
  ENDCASE.
  MODIFY it_fieldcat FROM x_fieldcat.
ENDLOOP.

x_layout-colwidth_optimize = 'X'.

CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
  EXPORTING
    i_grid_title  = 'Concert Information'
    is_layout     = x_layout
    it_fieldcat   = it_fieldcat
  TABLES
    t_outtab      = lt_sflight
  EXCEPTIONS
    program_error = 1
    OTHERS        = 2.

IF sy-subrc <> 0.
  MESSAGE 'Show data failed' TYPE 'E'.
ENDIF.