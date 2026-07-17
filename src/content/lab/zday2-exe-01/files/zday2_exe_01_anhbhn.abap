*&---------------------------------------------------------------------*
*& Program ZDAY2_EXE_01_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday2_exe_01_anhbhn.

DATA: w_time  TYPE sy-uzeit,
      w_hour  TYPE c LENGTH 2,
      w_min   TYPE c LENGTH 2,
      w_sec   TYPE c LENGTH 2,
      w_type  TYPE c,
      w_row   TYPE n LENGTH 2,
      w_col   TYPE n LENGTH 2,
      w_num   TYPE n LENGTH 2,
      w_index TYPE n LENGTH 2,
      w_cal   TYPE n LENGTH 2.

* Init value
w_time = sy-uzeit.

w_hour = w_time+0(2).
w_min  = w_time+2(2).
w_sec  = w_time+4(2).

w_row = w_min+0(1) + w_min+1(1).
w_col = w_sec+0(1) + w_sec+1(1).

DESCRIBE FIELD w_time TYPE w_type.

*WRITE: / 'Time:', w_time,
*       / 'Hour:', w_hour,
*       / 'Min:',  w_min,
*       / 'Sec:',  w_sec,
*       / 'Time Type:', w_type.

WRITE: / 'Times:', w_hour, 'h:', w_min, 'm:', w_sec, 's'.
WRITE: / 'Sum of number minutes: ', w_min+0(1), '+', w_min+1(1), '=' , w_row,
       / 'Sum of numeber seconds: ', w_sec+0(1), '+', w_sec+1(1), '=' ,w_col,
       / 'Column metric: ', w_col,
       / 'Row metric: ', w_row,
       /.

w_index = 1.

*w_row = 0.
*w_col = 0.

* Print result
DO w_row TIMES.
  w_cal = w_row - w_col.
  w_num = w_cal + w_index.

  IF w_num > w_col.
    w_num = w_col.
  ENDIF.

  WRITE: / '    '.
  DO w_num TIMES.
    WRITE: '  1'.
  ENDDO.

  w_index = w_index + 1.
ENDDO.