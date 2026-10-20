import test from 'node:test';
import assert from 'node:assert/strict';
import { username, readExport, readManual, nonFollowers } from './core.mjs';
test('normalizes usernames and rejects executable input and paths', () => {
  assert.equal(username(' @Alice.Name '), 'alice.name');
  for (const value of ['<script>', 'alice/profile', 'https://instagram.com/a', 'a'.repeat(31), '']) assert.equal(username(value), null);
});
test('reads split followers and current following title format', () => {
  const followers = readExport([{string_list_data:[{value:'Alice'}]},{string_list_data:[{value:'ALICE'}]}], 'followers');
  const following = readExport({relationships_following:[{title:'alice',string_list_data:[{href:'https://www.instagram.com/alice/'}]},{title:'bob',string_list_data:[]}]}, 'following');
  assert.deepEqual(nonFollowers(following, followers), ['bob']);
});
test('empty exports are supported; wrong file types and invalid entries are rejected', () => {
  assert.deepEqual(readExport([], 'followers'), []);
  assert.throws(() => readExport([], 'following'));
  assert.throws(() => readExport({relationships_following:[]}, 'followers'));
  assert.throws(() => readExport([{}], 'followers'));
  assert.throws(() => readExport([{string_list_data:[{href:'https://evil.test/alice'}]}], 'followers'));
});
test('manual selections are normalized, deduplicated, and validated', () => {
  assert.deepEqual(readManual('@Bob, alice\nBOB;carol'), ['alice','bob','carol']);
  assert.throws(() => readManual('valid invalid/name'));
  assert.deepEqual(nonFollowers(['bob','alice','bob'], []), ['alice','bob']);
});
