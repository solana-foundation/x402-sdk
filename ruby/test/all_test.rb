# frozen_string_literal: true

require_relative "test_helper"

Dir[File.join(__dir__, "*_test.rb")].sort.each do |path|
  require path unless path == __FILE__
end
