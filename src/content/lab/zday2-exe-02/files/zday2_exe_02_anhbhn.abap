*&---------------------------------------------------------------------*
*& Report ZDAY2_EXE_02_ANHBHN
*&---------------------------------------------------------------------*
*&
*&---------------------------------------------------------------------*
REPORT zday2_exe_02_anhbhn.

TYPES: BEGIN OF ty_dictionary,
         key   TYPE string,
         value TYPE string,
       END OF ty_dictionary.

TYPES: ty_dictionaries TYPE HASHED TABLE OF ty_dictionary
                    WITH UNIQUE KEY key.
*
*DATA(it_number_to_text) = VALUE ty_dictionaries(
*    ( key = '0' value = '' )
*    ( key = '1' value = 'Một' )
*    ( key = '2' value = 'Hai' )
*    ( key = '3' value = 'Ba' )
*    ( key = '4' value = 'Bốn' )
*    ( key = '5' value = 'Năm' )
*    ( key = '6' value = 'Sáu' )
*    ( key = '7' value = 'Bảy' )
*    ( key = '8' value = 'Tám' )
*    ( key = '9' value = 'Chín' )
*  ).
*
*DATA(it_index_to_place) = VALUE ty_dictionaries(
*    ( key = '1'  value = '' )
*    ( key = '2'  value = 'Mươi' )
*    ( key = '3'  value = 'Trăm' )
*    ( key = '4'  value = 'Ngàn' )
*    ( key = '5'  value = 'Triệu' )
*    ( key = '6'  value = 'Tỷ' )
*
*  ).

DATA: w_num_ipt TYPE string VALUE '4561',
      w_result  TYPE string,
      w_type    TYPE string.
*
*TRY.
*    PERFORM get_text_from_num USING w_num_ipt CHANGING w_result.
*  CATCH cx_root INTO DATA(lx_error).
*    w_result = lx_error->get_text( ).
*ENDTRY.
*
*WRITE:/ 'Input number: ', w_num_ipt.
*WRITE:/ 'Number in character: ', w_result.


PARAMETERS p_ipt TYPE string OBLIGATORY.

INITIALIZATION.
  DATA(it_number_to_text) = VALUE ty_dictionaries(
    ( key = '0' value = '' )
    ( key = '1' value = ' Một ' )
    ( key = '2' value = ' Hai ' )
    ( key = '3' value = ' Ba ' )
    ( key = '4' value = ' Bốn ' )
    ( key = '5' value = ' Năm ' )
    ( key = '6' value = ' Sáu ' )
    ( key = '7' value = ' Bảy ' )
    ( key = '8' value = ' Tám ' )
    ( key = '9' value = ' Chín ' )
  ).

  DATA(it_index_to_place) = VALUE ty_dictionaries(
    ( key = '1'  value = '' )
    ( key = '2'  value = ' Mươi ' )
    ( key = '3'  value = ' Trăm ' )
    ( key = '4'  value = ' Ngàn ' )
    ( key = '5'  value = ' Triệu ' )
    ( key = '6'  value = ' Tỷ ' )
  ).


AT SELECTION-SCREEN.
  TRY.
      w_result = ''.
      PERFORM get_text_from_num USING P_ipt CHANGING w_result.
    CATCH cx_root INTO DATA(lx_error).
      MESSAGE lx_error->get_text( ) TYPE 'E'.
  ENDTRY.

START-OF-SELECTION.
  DATA result TYPE string.

  WRITE:/ 'Input number: ', P_ipt.
  WRITE:/ 'Number in character: ', w_result.


FORM get_text_from_num USING p_n TYPE string
                        CHANGING p_t TYPE string.

  DATA: w_cleaned_p_n TYPE string.
  PERFORM get_cleaned_num USING p_n CHANGING w_cleaned_p_n.


  DATA(w_length) = strlen( w_cleaned_p_n ).
  IF w_length <= 3.
    PERFORM get_text_from_three_digit USING w_cleaned_p_n CHANGING p_t.
    IF p_t IS INITIAL.
      p_t = 'Không'.
    ENDIF.
    EXIT.
  ENDIF.

  DATA(w_3_digit_groups) = ( w_length + 2 ) DIV 3.
  DATA(w_position) = 0.
  DATA(p_reversed_n) = reverse( w_cleaned_p_n ).

  DATA: it_group_texts TYPE TABLE OF string.

  DO w_3_digit_groups TIMES.
    DATA(w_offset) = w_position * 3.

    DATA(w_remaining) = w_length - w_offset.
    DATA(w_group_len) = COND #( WHEN w_remaining < 3 THEN w_remaining ELSE 3 ).

    DATA(w_3_digit_group) = reverse( p_reversed_n+w_offset(w_group_len) ).

    IF w_3_digit_group CO '0'.
      APPEND '' TO it_group_texts.
      w_position = w_position + 1.
      CONTINUE.
    ENDIF.

    DATA(w_group_text) = ``.
    PERFORM get_text_from_three_digit USING w_3_digit_group CHANGING w_group_text.

    IF w_position > 0.
      DATA(w_cycle_index)  = ( w_position - 1 ) MOD 3.
      DATA(w_cycle_count)  = ( w_position - 1 ) DIV 3.
      DATA(w_place_number) = w_cycle_index + 4.
      DATA(w_base_key)     = '' && w_place_number && ''.
      DATA(w_place_suffix) = it_index_to_place[ key = w_base_key ]-value.

      DO w_cycle_count TIMES.
        w_place_suffix = w_place_suffix && ' Tỷ'.
      ENDDO.

      w_group_text = w_group_text && ' ' && w_place_suffix.
    ENDIF.

    APPEND w_group_text TO it_group_texts.

    w_position = w_position + 1.
  ENDDO.

  DATA(w_idx) = lines( it_group_texts ).
  WHILE w_idx > 0.
    READ TABLE it_group_texts INDEX w_idx INTO DATA(w_text_part).
    IF w_text_part IS NOT INITIAL.
      p_t = p_t && w_text_part && ' '.
    ENDIF.
    w_idx = w_idx - 1.
  ENDWHILE.

  CONDENSE p_t.
  IF p_t IS INITIAL.
    p_t = 'Không'.
  ENDIF.

ENDFORM.

FORM get_text_from_three_digit USING p_n TYPE string
                       CHANGING p_t TYPE string.
  DATA: w_cleaned_p_n TYPE string.
  PERFORM get_cleaned_num USING p_n CHANGING w_cleaned_p_n.

  DATA(w_length)       = strlen( w_cleaned_p_n ).
  DATA(w_position)     = w_length - 1.
  DATA(w_reversed_num) = reverse( w_cleaned_p_n ).

  IF w_length = 3.
    DO w_length TIMES.
      DATA(w_place_number) = w_position + 1.
      DATA(w_place_key)    = '' && w_place_number && ''.
      DATA(w_place_text)   = it_index_to_place[ key = w_place_key ]-value.

      DATA(w_digit)        = w_reversed_num+w_position(1).
      DATA(w_digit_text)   = it_number_to_text[ key = w_digit ]-value.

      CASE w_place_number.
        WHEN 3.
          IF w_digit <> '0'.
            p_t = p_t && w_digit_text && w_place_text.
          ENDIF.

        WHEN 2.
          IF w_digit = '1'.
            p_t = p_t && ' Mười'.
          ELSEIF w_digit <> '0'.
            p_t = p_t && w_digit_text && w_place_text.
          ELSEIF w_reversed_num+2(1) <> '0' AND w_reversed_num+0(1) <> '0'.
            p_t = p_t && ' Linh'.
          ENDIF.

        WHEN 1.
          IF w_digit = '1' AND w_reversed_num+1(1) >= '2'.
            p_t = p_t && ' Mốt'.
          ELSEIF w_digit = '5' AND w_reversed_num+1(1) <> '0'.
            p_t = p_t && ' Lăm'.
          ELSEIF w_digit <> '0'.
            p_t = p_t && w_digit_text.
          ENDIF.
      ENDCASE.

      w_position = w_position - 1.
      IF w_position < 0.
        EXIT.
      ENDIF.
    ENDDO.

  ELSEIF w_length = 2.
    IF w_cleaned_p_n < 20.
      DATA(w_char) = w_cleaned_p_n+1(1).
      IF w_char = '5'.
        p_t = p_t && ' Mười Lăm'.
      ELSE.
        p_t = p_t && ' Mười ' && it_number_to_text[ key = w_char ]-value.
      ENDIF.
    ELSE.
      DATA(w_unit_char) = w_cleaned_p_n+1(1).
      p_t = p_t && it_number_to_text[ key = w_cleaned_p_n+0(1) ]-value && ' Mươi'.
      IF w_unit_char = '1'.
        p_t = p_t && ' Mốt'.
      ELSEIF w_unit_char = '5'.
        p_t = p_t && ' Lăm'.
      ELSEIF w_unit_char <> '0'.
        p_t = p_t && it_number_to_text[ key = w_unit_char ]-value.
      ENDIF.
    ENDIF.

  ELSE.
    p_t = it_number_to_text[ key = w_cleaned_p_n ]-value.
  ENDIF.

ENDFORM.


FORM get_cleaned_num USING p_n TYPE string
                     CHANGING p_cleaned_n TYPE string.

  DATA(w_length) = strlen( p_n ).
  DATA(w_index)  = 0.

  DO w_length TIMES.
    IF p_n+w_index(1) = '0'.
      w_index = w_index + 1.
    ELSE.
      EXIT.
    ENDIF.
  ENDDO.

  IF w_index = w_length.
    p_cleaned_n = '0'.
  ELSE.
    DATA(w_length_index) = w_length - w_index.
    p_cleaned_n = p_n+w_index(w_length_index).
  ENDIF.

ENDFORM.