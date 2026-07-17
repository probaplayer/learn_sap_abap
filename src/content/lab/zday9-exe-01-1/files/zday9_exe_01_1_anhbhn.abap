*&---------------------------------------------------------------------*
*& Report ZDAY9_EXE_01_1_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday9_exe_01_1_anhbhn.

TYPES: BEGIN OF st_airline,
         id           TYPE scarr-carrid,
         airline      TYPE scarr-carrname,
         no           TYPE spfli-connid,
         depart_city  TYPE spfli-cityfrom,
         arrival_city TYPE spfli-cityto,
         depart       TYPE spfli-airpfrom,
         arrival      TYPE spfli-airpto,
       END OF st_airline.

DATA: lt_airline  TYPE TABLE OF st_airline,
      it_fieldcat TYPE slis_t_fieldcat_alv,
      x_fieldcat  TYPE slis_fieldcat_alv.


SELECT
scarr~carrid,
scarr~carrname,
spfli~connid,
spfli~cityfrom,
spfli~cityto,
spfli~airpfrom,
spfli~airpto
FROM scarr
JOIN spfli
ON scarr~carrid = spfli~carrid
INTO TABLE @lt_airline.


x_fieldcat-fieldname = 'ID'.
x_fieldcat-seltext_l = 'Airline Code'.
x_fieldcat-tabname   = 'LT_AIRLINE'.
x_fieldcat-col_pos   = 1.
APPEND x_fieldcat TO it_fieldcat.
CLEAR x_fieldcat.

x_fieldcat-fieldname = 'AIRLINE'.
x_fieldcat-seltext_l = 'Airline name'.
x_fieldcat-tabname   = 'LT_AIRLINE'.
x_fieldcat-col_pos   = 2.
APPEND x_fieldcat TO it_fieldcat.
CLEAR x_fieldcat.

x_fieldcat-fieldname = 'NO'.
x_fieldcat-seltext_l = 'Flight Connection Number'.
x_fieldcat-tabname   = 'LT_AIRLINE'.
x_fieldcat-col_pos   = 3.
APPEND x_fieldcat TO it_fieldcat.
CLEAR x_fieldcat.

x_fieldcat-fieldname = 'DEPART_CITY'.
x_fieldcat-seltext_l = 'Departure city'.
x_fieldcat-tabname   = 'LT_AIRLINE'.
x_fieldcat-col_pos   = 4.
APPEND x_fieldcat TO it_fieldcat.
CLEAR x_fieldcat.

x_fieldcat-fieldname = 'ARRIVAL_CITY'.
x_fieldcat-seltext_l = 'Arrival city'.
x_fieldcat-tabname   = 'LT_AIRLINE'.
x_fieldcat-col_pos   = 5.
APPEND x_fieldcat TO it_fieldcat.
CLEAR x_fieldcat.

x_fieldcat-fieldname = 'DEPART'.
x_fieldcat-seltext_l = 'Departure airport'.
x_fieldcat-tabname   = 'LT_AIRLINE1'.
x_fieldcat-col_pos   = 6.
APPEND x_fieldcat TO it_fieldcat.
CLEAR x_fieldcat.

x_fieldcat-fieldname = 'ARRIVAL'.
x_fieldcat-seltext_l = 'Destination airport'.
x_fieldcat-tabname   = 'LT_AIRLINE1'.
x_fieldcat-col_pos   = 7.
APPEND x_fieldcat TO it_fieldcat.
CLEAR x_fieldcat.


CALL FUNCTION 'REUSE_ALV_GRID_DISPLAY'
  EXPORTING
    it_fieldcat = it_fieldcat
  TABLES
    t_outtab    = lt_airline
 EXCEPTIONS
   PROGRAM_ERROR                     = 1
   OTHERS                            = 2.
          .
IF sy-subrc <> 0.
* Implement suitable error handling here
  MESSAGE 'Get data failed' TYPE 'E'.
ENDIF.