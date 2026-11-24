# frozen_string_literal: true

require 'regexp_parser'

# Turns a regexp_parser tree into the canonical JSON-able shape that
# src/parser/ast.ts emits. Raises on any expression it does not map, so a new
# construct fails loudly instead of being skipped.
module Normalize
  SYNTAX = 'ruby/3.4'
  QUANTIFIER_MODES = { greedy: 'greedy', reluctant: 'lazy', possessive: 'possessive' }.freeze

  module_function

  def parse(source, flags = '')
    options = 0
    options |= Regexp::EXTENDED if flags.include?('x')
    options |= Regexp::IGNORECASE if flags.include?('i')
    options |= Regexp::MULTILINE if flags.include?('m')
    node(Regexp::Parser.parse(source, SYNTAX, options: options))
  end

  def node(exp)
    kids = children(exp)
    case exp.type
    when :expression then { 'k' => 'seq', 'c' => kids }
    when :group then { 'k' => 'group', 't' => exp.token.to_s, 'c' => kids }
    when :assertion then { 'k' => 'group', 't' => exp.token.to_s, 'c' => kids }
    when :set then { 'k' => 'set', 't' => exp.token.to_s, 'c' => kids }
    when :meta then meta(exp, kids)
    when :conditional then { 'k' => 'cond', 't' => exp.token.to_s, 'c' => kids }
    else leaf(exp)
    end
  end

  def children(exp)
    return [] unless exp.respond_to?(:expressions)

    exp.expressions.flat_map { |child| wrap(child) }
  end

  # One quantifier wraps the one atom it follows; merged literals are split per character.
  def wrap(exp)
    return [] if exp.type == :free_space

    if exp.type == :literal && exp.text.length > 1
      chars = exp.text.chars.map { |c| { 'k' => 'lit', 's' => c } }
      chars[-1] = quantify(exp, chars[-1])
      return chars
    end
    [quantify(exp, node(exp))]
  end

  def quantify(exp, atom)
    q = exp.quantifier
    return atom unless q

    { 'k' => 'q', 'min' => q.min, 'max' => q.max == -1 ? nil : q.max,
      'mode' => QUANTIFIER_MODES.fetch(q.mode), 'c' => [atom] }
  end

  def meta(exp, kids)
    case exp.token
    when :alternation then { 'k' => 'alt', 'c' => kids }
    when :dot then { 'k' => 'cls', 's' => '.' }
    else raise "unmapped meta #{exp.token}"
    end
  end

  def leaf(exp)
    kind = {
      literal: 'lit', escape: 'esc', type: 'cls', anchor: 'anchor', keep: 'anchor',
      posixclass: 'posix', nonposixclass: 'posix', property: 'prop', nonproperty: 'prop',
      backref: 'ref', comment: 'comment', conditional: 'cond', set: 'set'
    }.fetch(exp.type) { raise "unmapped #{exp.type}/#{exp.token}" }
    kind = 'call' if exp.type == :backref && exp.token.to_s.end_with?('_call')
    { 'k' => kind, 's' => exp.text }
  end
end
