/// Sanitizes a given string by filtering out any characters that are not alphanumeric
/// or one of the following allowed special characters: space (' '), hyphen ('-'),
/// underscore ('_'), parentheses, or period.
///
/// # Parameters
/// - `s`: A `String` input containing the text to be sanitized.
///
/// # Returns
/// A new `String` containing only the allowed characters from the input.
pub fn sanitize_string(s: String) -> String {
    let sanitized: String = s
        .chars()
        .filter(|c| {
            c.is_alphanumeric()
                || *c == ' '
                || *c == '-'
                || *c == '_'
                || *c == '('
                || *c == ')'
                || *c == '.'
        })
        .collect();
    sanitized
        .trim_end_matches(|c| c == '.' || c == ' ')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::sanitize_string;

    #[test]
    fn keeps_allowed_characters_and_trims_forbidden_suffixes() {
        let sanitized = sanitize_string(" Note_Name-01 ().md.. ".to_string());

        assert_eq!(sanitized, " Note_Name-01 ().md");
    }

    #[test]
    fn removes_disallowed_characters_but_keeps_inner_spaces() {
        let sanitized = sanitize_string("Budget: Q2 / Draft #1".to_string());

        assert_eq!(sanitized, "Budget Q2  Draft 1");
    }

    #[test]
    fn can_sanitize_to_empty_string() {
        let sanitized = sanitize_string("...   ".to_string());

        assert_eq!(sanitized, "");
    }
}
